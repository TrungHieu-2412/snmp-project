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

    // Các cặp "IP_LoạiTấnCông" ĐANG đếm ngược (để chặn TRAP spam trong lúc chờ)
    private Set<String> activeMitigations = ConcurrentHashMap.newKeySet();

    // Các cặp "IP_LoạiTấnCông" ĐÃ bị bật tường lửa chặn thành công (Khóa vĩnh viễn theo loại)
    private Set<String> mitigatedAttacks = ConcurrentHashMap.newKeySet();

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
                    int setValue = 0; // Giá trị để gửi kèm SNMP SET

                    // Nhận diện theo payload từ auto_sensor.sh
                    if (value.contains("SYN_FLOOD_DETECTED")) {
                        attackType = "TCP SYN Flood";
                        attackMessage = "SYN Flood attack is occurred!";
                        setValue = 1;
                    } else if (value.contains("UDP_FLOOD_DETECTED")) {
                        attackType = "UDP Flood";
                        attackMessage = "UDP Flood attack is occurred!";
                        setValue = 2;
                    } else if (value.contains("GENERAL_TRAFFIC_SPIKE")) {
                        attackType = "ICMP / Traffic Spike";
                        attackMessage = "ICMP / Traffic Spike is occurred!";
                        setValue = 3;
                    }

                    if (attackType != null && setValue != 0) {
                        String targetIp = peerAddress.split("/")[0];

                        // Tạo khóa duy nhất cho phép chặn nhiều loại tấn công trên cùng 1 IP
                        String mitigationKey = targetIp + "_" + setValue;

                        // Nếu hệ thống ĐÃ TỪNG bật tường lửa cho loại này trên IP này rồi -> Im lặng 
                        if (mitigatedAttacks.contains(mitigationKey)) {
                            return;
                        }

                        // Nếu hệ thống ĐANG đếm ngược cho loại này -> Bỏ qua các TRAP rác đến sau
                        if (activeMitigations.contains(mitigationKey)) {
                            return;
                        }

                        // Đưa cặp IP_Loại này vào danh sách ĐANG XỬ LÝ
                        activeMitigations.add(mitigationKey);

                        logger.warn("⚠️ SECURITY WARNING: Received TRAP packet from [{}]", peerAddress);
                        logger.error("[IDPS ALERT] ATTACK DETECTED: {} | TARGET: {} | STATUS: PROCESSING",
                                attackType, targetIp);

                        int currentDelay = this.mitigationDelay;
                        final int finalSetValue = setValue; // Dùng cho hàm Lambda chạy nền

                        // Log
                        Map<String, Object> log = new ConcurrentHashMap<>();
                        log.put("key", String.valueOf(logIdCounter++));
                        log.put("startTime", new SimpleDateFormat("HH:mm:ss").format(new Date()));
                        log.put("attackType", attackType);
                        log.put("delay", currentDelay + "s");
                        log.put("status", "Processing...");
                        evaluationLogs.add(log);

                        // Cảnh báo cho Frontend
                        Map<String, String> alert = new ConcurrentHashMap<>();
                        alert.put("time", String.valueOf(System.currentTimeMillis()));
                        alert.put("ip", targetIp);
                        alert.put("typeId", String.valueOf(setValue)); // Thêm typeId để FE biết loại nào để gửi lại khi nhấn Manual
                        alert.put("attackType", attackType);
                        alert.put("message", attackMessage);
                        alertHistory.add(alert);

                        if (isAutoMode) {
                            if (currentDelay > 0) {
                                logger.warn(
                                        "⌛ The system will automatically activate the Iptables shield (Type: {}) after {} seconds...",
                                        finalSetValue, currentDelay);
                            } else {
                                logger.warn("⚡ 0s Mode: Activating Iptables shield (Type: {}) IMMEDIATELY...",
                                        finalSetValue);
                            }

                            // Chạy task bật tường lửa bất đồng bộ sau X giây đếm ngược
                            CompletableFuture.runAsync(() -> {
                                // Truyền thêm finalSetValue vào hàm trigger
                                boolean success = triggerMitigationSet(targetIp, finalSetValue);

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
                                    // Ghi nhận IP này đã được bảo vệ thành công khỏi LOẠI TẤN CÔNG NÀY
                                    mitigatedAttacks.add(mitigationKey);
                                }

                                // đếm ngược kết thúc -> Mở khóa chờ cho loại tấn công này
                                activeMitigations.remove(mitigationKey);

                            }, CompletableFuture.delayedExecutor(currentDelay, TimeUnit.SECONDS));
                        } else {
                            logger.warn("⚠️ Auto-IPS is Disabled. Waiting for manual intervention...");
                            log.put("status", "Manual Pending");
                            alert.put("status", "Processing...");

                            // Trả lại trạng thái tự do để chờ lệnh thủ công
                            activeMitigations.remove(mitigationKey);
                        }
                    }
                });
            }
        }
    }

    // Truyền thêm tham số setValue để quy định loại Shield sẽ bật
    public boolean triggerMitigationSet(String targetIp, int setValue) {
        logger.info("⚡ ACTION: Sending SNMP SET (Value: {}) to {} to activate defense...", setValue, targetIp);
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
            // Ánh xạ OID kèm theo Giá trị kích hoạt tương ứng (1, 2, hoặc 3)
            pdu.add(new VariableBinding(new OID(SCRIPT_TRIGGER_OID), new Integer32(setValue)));

            ResponseEvent responseEvent = snmp.send(pdu, target);
            PDU responsePDU = responseEvent.getResponse();

            if (responsePDU != null && responsePDU.getErrorStatus() == PDU.noError) {
                logger.info("✅ SUCCESS: The Iptables (Type {}) has been successfully set up at {}!", setValue,
                        targetIp);
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

    // Overload hàm trigger cho trường hợp kích hoạt thủ công từ giao diện
    public boolean triggerMitigationSet(String targetIp) {
        // Mặc định gọi khiên 1 (TCP SYN) nếu không truyền tham số (fallback an toàn)
        return triggerMitigationSet(targetIp, 1);
    }

    public void setMitigationDelay(int delay) {
        this.mitigationDelay = delay;
        logger.info("⚙️ System configuration: Auto-IPS delay time has been updated to {} seconds", delay);
    }

    public void setAutoMode(boolean autoMode) {
        this.isAutoMode = autoMode;
        logger.info("⚙️ System configuration: Auto-IPS mode has been set to {}", autoMode ? "ON" : "OFF");
    }

    // Cập nhật lại Reset State
    public void resetMitigationState() {
        activeMitigations.clear();
        mitigatedAttacks.clear();
        logger.info("🔄 System state reset: Cleared all active and mitigated Attack records.");
    }

    public List<Map<String, Object>> getEvaluationLogs() {
        return evaluationLogs;
    }

    public List<Map<String, String>> getAlertHistory() {
        return alertHistory;
    }
}