package org.example;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.snmp4j.*;
import org.snmp4j.event.ResponseEvent;
import org.snmp4j.mp.SnmpConstants;
import org.snmp4j.smi.*;
import org.snmp4j.transport.DefaultUdpTransportMapping;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import jakarta.annotation.PostConstruct;

import java.io.IOException;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.*;

@Service
public class TrapReceiverService implements CommandResponder {
    private static final Logger logger = LoggerFactory.getLogger(TrapReceiverService.class);

    private static final String TRAP_LISTEN_ADDRESS = "0.0.0.0/10162";
    private static final String RW_COMMUNITY = "private_admin";
    private static final String SET_TARGET_PORT = "161";
    private static final String SCRIPT_TRIGGER_OID = "1.3.6.1.4.1.9999.1.0";

    @Autowired
    private SnmpPollerService pollerService;

    private List<Map<String, String>> alertHistory = new ArrayList<>();
    private List<Map<String, Object>> evaluationLogs = new ArrayList<>();
    private int logIdCounter = 1;

    private int mitigationDelay = 10; 

    private final ScheduledExecutorService scheduler = Executors.newSingleThreadScheduledExecutor();
    private ScheduledFuture<?> pendingTask = null; 
    private Map<String, Object> currentProcessingLog = null;

    @PostConstruct
    public void startListening() {
        try {
            Address listenAddress = GenericAddress.parse("udp:" + TRAP_LISTEN_ADDRESS);
            TransportMapping<?> transport = new DefaultUdpTransportMapping((UdpAddress) listenAddress);
            Snmp snmp = new Snmp(transport);
            snmp.addCommandResponder(this);
            transport.listen();
            logger.info("✅ NMS SYSTEM: Listening for TRAP packet at port {}", TRAP_LISTEN_ADDRESS);
        } catch (IOException e) {
            logger.error("❌ Trap Receiver initialization error: ", e);
        }
    }

    @Override
    public void processPdu(CommandResponderEvent event) {
        if (event.getPDU() != null) {
            String peerAddress = event.getPeerAddress().toString();
            int pduType = event.getPDU().getType();

            if (pduType == PDU.TRAP || pduType == PDU.V1TRAP || pduType == PDU.INFORM) {
                logger.warn("⚠️ SECURITY WARNING: Received TRAP packet from [{}]", peerAddress);

                event.getPDU().getVariableBindings().forEach(vb -> {
                    String value = vb.getVariable().toString();

                    if (value.contains("SYN_FLOOD_DETECTED")) {
                        String targetIp = peerAddress.split("/")[0];
                        
                        if (pendingTask != null && !pendingTask.isDone()) {
                            logger.warn("⏳ Đang đếm ngược chặn {}, bỏ qua cảnh báo trùng lặp để không reset timer...", targetIp);
                            return; 
                        }
                        
                        Map<String, Object> log = new ConcurrentHashMap<>();
                        log.put("key", String.valueOf(logIdCounter++));
                        log.put("startTime", new SimpleDateFormat("HH:mm:ss").format(new Date()));
                        log.put("attackType", "TCP SYN Flood");
                        log.put("delay", this.mitigationDelay + "s");
                        log.put("status", "Đang chờ chặn...");
                        evaluationLogs.add(log);
                        this.currentProcessingLog = log;

                        Map<String, String> alert = new ConcurrentHashMap<>();
                        alert.put("time", String.valueOf(System.currentTimeMillis()));
                        alert.put("ip", targetIp);
                        alert.put("attackType", "TCP SYN Flood");
                        alert.put("message", "SYN Flood attack is occurred!");
                        alertHistory.add(alert);

                        logger.error("[VERIFICATION SYSTEM]: SYN Flood attack is occurred at {}!", targetIp);
                        logger.warn("The system will automatically activate the Iptables shield after " + this.mitigationDelay + " seconds...");

                        pendingTask = scheduler.schedule(() -> {
                            executeMitigation(targetIp, log);
                        }, this.mitigationDelay, TimeUnit.SECONDS);
                    }
                });
            }
        }
    }

    public boolean triggerManualMitigation(String targetIp) {
        logger.warn("[!] USER ACTION: Manual Block pressed. Cancelling auto-task...");
        
        if (pendingTask != null && !pendingTask.isDone()) {
            pendingTask.cancel(false);
            logger.info("[*] Pending auto-task has been cancelled successfully.");
        }

        return executeMitigation(targetIp, this.currentProcessingLog);
    }

    private boolean executeMitigation(String targetIp, Map<String, Object> log) {
        boolean success = triggerMitigationSet(targetIp);

        if (log != null) {
            Map<String, Object> currentMetrics = pollerService.getLatestMetrics();
            log.put("endTime", new SimpleDateFormat("HH:mm:ss").format(new Date()));
            log.put("minBandwidth", currentMetrics.getOrDefault("downKbps", "0") + " Kbps");
            log.put("maxPps", currentMetrics.getOrDefault("inPps", "0"));
            log.put("maxCpu", currentMetrics.getOrDefault("cpu", "0") + "%");
            log.put("maxRam", currentMetrics.getOrDefault("ram", "0") + "%");
            log.put("maxTcp", currentMetrics.getOrDefault("tcp", "0"));
            log.put("status", success ? "Đã chặn" : "Thất bại");
        }
        
        this.currentProcessingLog = null;
        this.pendingTask = null;
        return success;
    }

    public boolean triggerMitigationSet(String targetIp) {
        try {
            TransportMapping<? extends Address> transport = new DefaultUdpTransportMapping();
            transport.listen();
            Snmp snmp = new Snmp(transport);

            Address targetAddress = GenericAddress.parse("udp:" + targetIp + "/" + SET_TARGET_PORT);
            CommunityTarget target = new CommunityTarget();
            target.setCommunity(new OctetString(RW_COMMUNITY));
            target.setAddress(targetAddress);
            target.setRetries(1);
            target.setTimeout(2000);
            target.setVersion(SnmpConstants.version2c);

            PDU pdu = new PDU();
            pdu.setType(PDU.SET);
            pdu.add(new VariableBinding(new OID(SCRIPT_TRIGGER_OID), new Integer32(1)));

            ResponseEvent responseEvent = snmp.send(pdu, target);
            PDU responsePDU = responseEvent.getResponse();

            if (responsePDU != null && responsePDU.getErrorStatus() == PDU.noError) {
                logger.info("✅ MITIGATION SUCCESS: Iptables active at {}", targetIp);
                snmp.close();
                return true;
            } else {
                logger.error("❌ SNMP SET FAILED at {}. Check rwcommunity or script path.", targetIp);
                snmp.close();
                return false;
            }
        } catch (Exception e) {
            logger.error("❌ SNMP ERROR: ", e);
            return false;
        }
    }

    public void setMitigationDelay(int delay) {
        this.mitigationDelay = delay;
        logger.info("[*] Cấu hình: Đã cập nhật delay Auto-IPS thành {} giây", delay);
    }

    public List<Map<String, Object>> getEvaluationLogs() {
        return evaluationLogs;
    }

    public List<Map<String, String>> getAlertHistory() {
        return alertHistory;
    }
}
