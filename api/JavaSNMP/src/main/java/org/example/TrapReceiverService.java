// TrapReceiverService.java: Module nhận Cảnh báo (TRAP) và Kích hoạt tự động (SET) cho máy Agent khi bị tấn công.
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
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;

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
    private boolean isAutoMode = true;

    // Cấu hình cổng lắng nghe TRAP (10162) để nhận các cảnh báo từ Agent đẩy về.
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

    // Được gọi tự động mỗi khi Agent gửi một TRAP thông báo có nguy hiểm mạng (SYN
    // Flood, v.v.).
    @Override
    public void processPdu(CommandResponderEvent event) {
        if (event.getPDU() != null) {
            String peerAddress = event.getPeerAddress().toString();
            int pduType = event.getPDU().getType();

            if (pduType == PDU.TRAP || pduType == PDU.V1TRAP) {
                logger.warn("⚠️ SECURITY WARNING: Received TRAP packet from [{}]", peerAddress);

                event.getPDU().getVariableBindings().forEach(vb -> {
                    String value = vb.getVariable().toString();

                    if (value.contains("SYN_FLOOD_DETECTED")) {
                        String targetIp = peerAddress.split("/")[0];
                        int currentDelay = this.mitigationDelay;

                        Map<String, Object> log = new ConcurrentHashMap<>();
                        log.put("key", String.valueOf(logIdCounter++));
                        log.put("startTime", new SimpleDateFormat("HH:mm:ss").format(new Date()));
                        log.put("attackType", "TCP SYN Flood");
                        log.put("delay", "10s");
                        log.put("status", "Processing...");
                        evaluationLogs.add(log);

                        Map<String, String> alert = new ConcurrentHashMap<>();
                        alert.put("time", String.valueOf(System.currentTimeMillis()));
                        alert.put("ip", targetIp);
                        alert.put("attackType", "TCP SYN Flood");
                        alert.put("message", "SYN Flood attack is occurred!");

                        alertHistory.add(alert);

                        logger.error("[VERIFICATION SYSTEM]: SYN Flood attack is occurred at {}!", targetIp);
                        
                        if (isAutoMode) {
                            logger.warn("⌛ The system will automatically activate the Iptables shield after {} seconds...", currentDelay);

                            CompletableFuture.runAsync(() -> {
                                boolean success = triggerMitigationSet(targetIp);

                                Map<String, Object> currentMetrics = pollerService.getMetricsByIp(targetIp);

                                log.put("endTime", new SimpleDateFormat("HH:mm:ss").format(new Date()));
                                log.put("minBandwidth", currentMetrics.getOrDefault("downKbps", "0") + " Kbps");
                                log.put("maxPps", currentMetrics.getOrDefault("inPps", "0"));
                                log.put("maxCpu", currentMetrics.getOrDefault("cpu", "0") + "%");
                                log.put("maxRam", currentMetrics.getOrDefault("ram", "0") + "%");
                                log.put("maxTcp", currentMetrics.getOrDefault("tcp", "0"));
                                log.put("status", success ? "Resolved" : "Failed");

                                if (success) {
                                    alert.put("status", "Resolved");
                                }

                            }, CompletableFuture.delayedExecutor(currentDelay, TimeUnit.SECONDS));
                        } else {
                            logger.warn("⚠️ Auto-IPS is Disabled. Waiting for manual intervention...");
                            log.put("status", "Manual Pending");
                            alert.put("status", "Processing..."); // Giữ Processing để cảnh báo FE vẫn hiển thị Đỏ
                        }
                    }
                });
            }
        }
    }

    // Giao tiếp ghi đè cấu hình tới Agent để kích hoạt lá chắn Firewall.
    public boolean triggerMitigationSet(String targetIp) {
        logger.info("⚡ ACTION: Sending SNMP SET to {} to activate defense...", targetIp);
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
                logger.info("✅ SUCCESS: The Iptables has been successfully set up at {}!", targetIp);
                snmp.close();
                return true;
            } else {
                logger.error("❌ FAILED: SNMP Agent rejected the SET command. Please check rwcommunity in snmpd.conf.");
                snmp.close();
                return false;
            }

        } catch (Exception e) {
            logger.error("❌ ERROR: ", e);
            return false;
        }
    }

    // Hàm hỗ trợ cập nhật cấu hình độ trễ Delay (phục vụ mục đích đánh giá hiệu
    // năng) từ Frontend đẩy xuống.
    public void setMitigationDelay(int delay) {
        this.mitigationDelay = delay;
        logger.info("⚙️ System configuration: Auto-IPS delay time has been updated to {} seconds", delay);
    }

    public void setAutoMode(boolean autoMode) {
        this.isAutoMode = autoMode;
        logger.info("⚙️ System configuration: Auto-IPS mode has been set to {}", autoMode ? "ON" : "OFF");
    }

    // Trả về báo cáo Log chi tiết quá trình bắt đầu, thời gian trễ và kết quả chặn.
    public List<Map<String, Object>> getEvaluationLogs() {
        return evaluationLogs;
    }

    // Lấy danh sách lịch sử cảnh báo tấn công để hiển thị lên bảng điều khiển
    // Frontend.
    public List<Map<String, String>> getAlertHistory() {
        return alertHistory;
    }
}