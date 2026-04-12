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
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;

@Service
public class TrapReceiverService implements CommandResponder {
    private static final Logger logger = LoggerFactory.getLogger(TrapReceiverService.class);

    // Lắng nghe TRAP trên tất cả các interface (0.0.0.0), sử dụng cổng 10162
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

    // Các IP ĐANG đếm ngược (để chặn TRAP spam trong lúc chờ)
    private Set<String> activeMitigations = ConcurrentHashMap.newKeySet();

    // Các IP ĐÃ bị bật tường lửa chặn thành công (Khóa tĩnh lặng vĩnh viễn)
    private Set<String> mitigatedIps = ConcurrentHashMap.newKeySet();

    @PostConstruct
    public void startListening() {
        try {
            Address listenAddress = GenericAddress.parse("udp:" + TRAP_LISTEN_ADDRESS);
            TransportMapping<?> transport = new DefaultUdpTransportMapping((UdpAddress) listenAddress);
            Snmp snmp = new Snmp(transport);
            snmp.addCommandResponder(this);
            transport.listen();
            logger.info("✅ NMS TRAP: Listening for TRAP packet at port {}", TRAP_LISTEN_ADDRESS);
        } catch (IOException e) {
            logger.error("❌ Trap Receiver initialization error: ", e);
        }
    }

    @Override
    public void processPdu(CommandResponderEvent event) {
        if (event.getPDU() != null) {
            String peerAddress = event.getPeerAddress().toString();
            int pduType = event.getPDU().getType();

            if (pduType == PDU.TRAP || pduType == PDU.V1TRAP) {
                event.getPDU().getVariableBindings().forEach(vb -> {
                    String value = vb.getVariable().toString();
                    String attackType = null;
                    String attackMessage = null;

                    // Nhận diện theo payload từ auto_sensor.sh
                    if (value.contains("SYN_FLOOD_DETECTED")) {
                        attackType = "TCP SYN Flood";
                        attackMessage = "SYN Flood attack is occurred!";
                    } else if (value.contains("UDP_FLOOD_DETECTED")) {
                        attackType = "UDP Flood";
                        attackMessage = "UDP Flood attack is occurred!";
                    } else if (value.contains("GENERAL_TRAFFIC_SPIKE")) {
                        attackType = "TCP ACK Flood";
                        attackMessage = "TCP ACK Flood / Traffic Spike is occurred!";
                    }

                    if (attackType != null) {
                        String targetIp = peerAddress.split("/")[0];

                        // ONE-AND-DONE 
                        // Nếu hệ thống ĐÃ TỪNG bật tường lửa thành công cho IP này rồi -> Im lặng 
                        if (mitigatedIps.contains(targetIp)) {
                            return;
                        }

                        // Nếu hệ thống ĐANG đếm ngược cho IP này -> Bỏ qua các TRAP rác đến sau
                        if (activeMitigations.contains(targetIp)) {
                            return;
                        }

                        // Đưa IP vào danh sách ĐANG XỬ LÝ
                        activeMitigations.add(targetIp);

                        logger.warn("⚠️ SECURITY WARNING: Received TRAP packet from [{}]", peerAddress);
                        logger.error("[VERIFICATION SYSTEM]: {} at {}!", attackMessage, targetIp);

                        int currentDelay = this.mitigationDelay;

                        // log
                        Map<String, Object> log = new ConcurrentHashMap<>();
                        log.put("key", String.valueOf(logIdCounter++));
                        log.put("startTime", new SimpleDateFormat("HH:mm:ss").format(new Date()));
                        log.put("attackType", attackType);
                        log.put("delay", currentDelay + "s");
                        log.put("status", "Processing...");
                        evaluationLogs.add(log);

                        // cảnh báo cho Frontend
                        Map<String, String> alert = new ConcurrentHashMap<>();
                        alert.put("time", String.valueOf(System.currentTimeMillis()));
                        alert.put("ip", targetIp);
                        alert.put("attackType", attackType);
                        alert.put("message", attackMessage);
                        alertHistory.add(alert);

                        if (isAutoMode) {
                            if (currentDelay > 0) {
                                logger.warn(
                                        "⌛ The system will automatically activate the Iptables shield after {} seconds...",
                                        currentDelay);
                            } else {
                                logger.warn("⚡ 0s Mode: Activating Iptables shield IMMEDIATELY...");
                            }

                            // Chạy task bật tường lửa bất đồng bộ sau X giây đếm ngược
                            CompletableFuture.runAsync(() -> {
                                boolean success = triggerMitigationSet(targetIp);

                                // Lấy số liệu sau chặn
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
                                    // Ghi nhận IP này đã được bảo vệ thành công -> Khóa vĩnh viễn
                                    mitigatedIps.add(targetIp);
                                }

                                // đếm ngược kết thúc -> Mở khóa chờ
                                activeMitigations.remove(targetIp);

                            }, CompletableFuture.delayedExecutor(currentDelay, TimeUnit.SECONDS));
                        } else {
                            logger.warn("⚠️ Auto-IPS is Disabled. Waiting for manual intervention...");
                            log.put("status", "Manual Pending");
                            alert.put("status", "Processing...");

                            // Trả IP về trạng thái tự do để chờ lệnh thủ công
                            activeMitigations.remove(targetIp);
                        }
                    }
                });
            }
        }
    }

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
            target.setTimeout(1500);
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

    public void setMitigationDelay(int delay) {
        this.mitigationDelay = delay;
        logger.info("⚙️ System configuration: Auto-IPS delay time has been updated to {} seconds", delay);
    }

    public void setAutoMode(boolean autoMode) {
        this.isAutoMode = autoMode;
        logger.info("⚙️ System configuration: Auto-IPS mode has been set to {}", autoMode ? "ON" : "OFF");
    }

    // Hàm tiện ích: Khi muốn test lại kịch bản từ đầu
    public void resetMitigationState() {
        activeMitigations.clear();
        mitigatedIps.clear();
        logger.info("🔄 System state reset: Cleared all active and mitigated IP records.");
    }

    public List<Map<String, Object>> getEvaluationLogs() {
        return evaluationLogs;
    }

    public List<Map<String, String>> getAlertHistory() {
        return alertHistory;
    }
}