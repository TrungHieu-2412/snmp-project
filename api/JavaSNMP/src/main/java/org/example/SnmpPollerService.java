package org.example;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.snmp4j.CommunityTarget;
import org.snmp4j.PDU;
import org.snmp4j.Snmp;
import org.snmp4j.TransportMapping;
import org.snmp4j.event.ResponseEvent;
import org.snmp4j.mp.SnmpConstants;
import org.snmp4j.smi.*;
import org.snmp4j.transport.DefaultUdpTransportMapping;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import jakarta.annotation.PostConstruct;
import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CopyOnWriteArrayList;

@Service
public class SnmpPollerService {
    private static final Logger logger = LoggerFactory.getLogger(SnmpPollerService.class);

    private static final int SNMP_PORT = 161;
    private static final String RO_COMMUNITY = "public";

    private static final String OID_IN_OCTETS = "1.3.6.1.2.1.2.2.1.10.2";
    private static final String OID_OUT_OCTETS = "1.3.6.1.2.1.2.2.1.16.2";
    private static final String OID_IN_PKTS = "1.3.6.1.2.1.2.2.1.11.2";
    private static final String OID_OUT_PKTS = "1.3.6.1.2.1.2.2.1.17.2";
    private static final String OID_CPU_IDLE = "1.3.6.1.4.1.2021.11.11.0";
    private static final String OID_RAM_TOTAL = "1.3.6.1.4.1.2021.4.5.0";
    private static final String OID_RAM_AVAIL = "1.3.6.1.4.1.2021.4.6.0";
    private static final String OID_TCP_CURR = "1.3.6.1.2.1.6.9.0";

    private List<String> targetIps = new CopyOnWriteArrayList<>();

    private class VmState {
        long lastInBytes = 0; long lastOutBytes = 0;
        long lastInPkts = 0;  long lastOutPkts = 0;
        long lastTime = 0;
    }
    private Map<String, VmState> states = new ConcurrentHashMap<>();

    private Map<String, Map<String, Object>> allMetrics = new ConcurrentHashMap<>();

    private Snmp snmp;

    @PostConstruct
    public void init() {
        try {
            TransportMapping<? extends Address> transport = new DefaultUdpTransportMapping();
            transport.listen();
            snmp = new Snmp(transport);

            addDevice("10.0.1.2");
            addDevice("10.0.2.2");

            logger.info("✅ NMS POLLER: Started Multi-Agent Polling Service!");
        } catch (IOException e) {
            logger.error("❌ SNMP Poller Initialization Error: ", e);
        }
    }

    public void addDevice(String ip) {
        if (!targetIps.contains(ip)) {
            targetIps.add(ip);
            states.put(ip, new VmState()); // Tạo kho lưu trữ cũ cho IP này
            logger.info("[+] Added new Agent to monitor: {}", ip);
        }
    }

    @Scheduled(fixedRate = 5000)
    public void pollAllMetrics() {
        for (String ip : targetIps) {
            pollSingleVm(ip);
        }
    }

    private void pollSingleVm(String ip) {
        try {
            Address targetAddress = GenericAddress.parse("udp:" + ip + "/" + SNMP_PORT);
            CommunityTarget target = new CommunityTarget();
            target.setCommunity(new OctetString(RO_COMMUNITY));
            target.setAddress(targetAddress);
            target.setRetries(1);
            target.setTimeout(1500);
            target.setVersion(SnmpConstants.version2c);

            PDU pdu = new PDU();
            pdu.add(new VariableBinding(new OID(OID_IN_OCTETS)));
            pdu.add(new VariableBinding(new OID(OID_OUT_OCTETS)));
            pdu.add(new VariableBinding(new OID(OID_IN_PKTS)));
            pdu.add(new VariableBinding(new OID(OID_OUT_PKTS)));
            pdu.add(new VariableBinding(new OID(OID_CPU_IDLE)));
            pdu.add(new VariableBinding(new OID(OID_RAM_TOTAL)));
            pdu.add(new VariableBinding(new OID(OID_RAM_AVAIL)));
            pdu.add(new VariableBinding(new OID(OID_TCP_CURR)));
            pdu.setType(PDU.GET);

            ResponseEvent responseEvent = snmp.send(pdu, target);
            PDU responsePDU = responseEvent.getResponse();

            Map<String, Object> metrics = new ConcurrentHashMap<>();

            if (responsePDU != null && responsePDU.getErrorStatus() == PDU.noError) {
                String inBytesStr = responsePDU.getVariableBindings().get(0).getVariable().toString();
                String outBytesStr = responsePDU.getVariableBindings().get(1).getVariable().toString();
                String inPktsStr = responsePDU.getVariableBindings().get(2).getVariable().toString();
                String outPktsStr = responsePDU.getVariableBindings().get(3).getVariable().toString();
                String cpuIdleStr = responsePDU.getVariableBindings().get(4).getVariable().toString();
                String ramTotalStr = responsePDU.getVariableBindings().get(5).getVariable().toString();
                String ramAvailStr = responsePDU.getVariableBindings().get(6).getVariable().toString();
                String tcpCurrStr = responsePDU.getVariableBindings().get(7).getVariable().toString();

                if(inBytesStr.equals("noSuchObject")) return;

                long cpuUsage = 100 - Long.parseLong(cpuIdleStr);
                long ramTotal = Long.parseLong(ramTotalStr);
                long ramAvail = Long.parseLong(ramAvailStr);
                double ramUsage = ((double)(ramTotal - ramAvail) / ramTotal) * 100;

                long tcpConns = Long.parseLong(tcpCurrStr);
                long currentInBytes = Long.parseLong(inBytesStr);
                long currentOutBytes = Long.parseLong(outBytesStr);
                long currentInPkts = Long.parseLong(inPktsStr);
                long currentOutPkts = Long.parseLong(outPktsStr);
                long currentTime = System.currentTimeMillis();

                long inKbps = 0, outKbps = 0, inPps = 0, outPps = 0;
                VmState state = states.get(ip);

                if (state.lastTime != 0) {
                    long diffTimeSeconds = (currentTime - state.lastTime) / 1000;
                    if (diffTimeSeconds > 0) {
                        inKbps = ((currentInBytes - state.lastInBytes) * 8) / diffTimeSeconds / 1024;
                        outKbps = ((currentOutBytes - state.lastOutBytes) * 8) / diffTimeSeconds / 1024;
                        inPps = (currentInPkts - state.lastInPkts) / diffTimeSeconds;
                        outPps = (currentOutPkts - state.lastOutPkts) / diffTimeSeconds;
                    }
                }

                state.lastInBytes = currentInBytes; state.lastOutBytes = currentOutBytes;
                state.lastInPkts = currentInPkts;   state.lastOutPkts = currentOutPkts;
                state.lastTime = currentTime;

                metrics.put("cpu", cpuUsage);
                metrics.put("ram", Math.round(ramUsage * 100.0) / 100.0);
                metrics.put("downKbps", inKbps);  metrics.put("upKbps", outKbps);
                metrics.put("inPps", inPps);      metrics.put("outPps", outPps);
                metrics.put("tcp", tcpConns);
                metrics.put("status", "ONLINE");

                logger.info("[{}] CPU: {}% | RAM: {}% | Down: {} Kbps | In: {} pps | TCP: {}",
                        ip, cpuUsage, String.format("%.1f", ramUsage), inKbps, inPps, tcpConns);
            } else {
                metrics.put("status", "OFFLINE");
            }
            allMetrics.put(ip, metrics);

        } catch (Exception e) {
            logger.error("❌ Error polling data from {}: {}", ip, e.getMessage());
        }
    }
    public Map<String, Map<String, Object>> getAllMetrics() {
        return allMetrics;
    }

    public Map<String, Object> getMetricsByIp(String ip) {
        return allMetrics.getOrDefault(ip, new ConcurrentHashMap<>());
    }
}