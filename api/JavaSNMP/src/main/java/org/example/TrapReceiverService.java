// TrapReceiverService.java: Module nhận Cảnh báo (TRAP) và Kích hoạt tự động (SET)
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

    // Cấu hình giao tiếp SNMP
    private static final String TRAP_LISTEN_ADDRESS = "0.0.0.0/10162"; // Cổng lắng nghe TRAP từ Agent bắn về
    private static final String RW_COMMUNITY = "private_admin"; // Mật khẩu có quyền SET cấu hình trên Agent
    private static final String SET_TARGET_PORT = "161"; // Cổng đích để gửi lệnh SET
    private static final String SCRIPT_TRIGGER_OID = "1.3.6.1.4.1.9999.1.0"; // OID dùng để kích hoạt script Iptables
                                                                             // trên Agent

    @Autowired
    private SnmpPollerService pollerService; // Mượn dữ liệu CPU/RAM/PPS để ghi log

    private List<Map<String, String>> alertHistory = new ArrayList<>();
    private List<Map<String, Object>> evaluationLogs = new ArrayList<>();
    private int logIdCounter = 1;

    private int mitigationDelay = 10; // Biến quản lý độ trễ tự động (mặc định 10s)

    @PostConstruct
    public void startListening() {
        try {
            // Mở cổng UDP 10162 để luôn luôn lắng nghe gói tin TRAP
            Address listenAddress = GenericAddress.parse("udp:" + TRAP_LISTEN_ADDRESS);
            TransportMapping<?> transport = new DefaultUdpTransportMapping((UdpAddress) listenAddress);

            Snmp snmp = new Snmp(transport);
            snmp.addCommandResponder(this); // Đăng ký class này là Nơi xử lý (Responder) khi có sự kiện mạng tới

            transport.listen();
            logger.info("✅ NMS SYSTEM: Listening for TRAP packet at port {}", TRAP_LISTEN_ADDRESS);

        } catch (IOException e) {
            logger.error("❌ Trap Receiver initialization error: ", e);
        }
    }

    // Tự động được kích hoạt (Trigger) mỗi khi có 1 gói tin đập vào cổng 10162
    @Override
    public void processPdu(CommandResponderEvent event) {
        if (event.getPDU() != null) {
            String peerAddress = event.getPeerAddress().toString(); // Lấy IP của Agent
            int pduType = event.getPDU().getType(); // Kiểm tra loại gói tin

            // Chỉ xử lý nếu đúng là gói tin cảnh báo (TRAP)
            if (pduType == PDU.TRAP || pduType == PDU.V1TRAP) {
                logger.warn("⚠️ SECURITY WARNING: Received TRAP packet from [{}]", peerAddress);

                // Duyệt qua nội dung của gói tin TRAP
                event.getPDU().getVariableBindings().forEach(vb -> {
                    String value = vb.getVariable().toString();

                    // Nếu nội dung chứa đúng "Mật mã" bị tấn công
                    if (value.contains("SYN_FLOOD_DETECTED")) {
                        String targetIp = peerAddress.split("/")[0];
                        int currentDelay = this.mitigationDelay;

                        // Tạo log đánh giá hệ thống
                        Map<String, Object> log = new ConcurrentHashMap<>();
                        log.put("key", String.valueOf(logIdCounter++));
                        log.put("startTime", new SimpleDateFormat("HH:mm:ss").format(new Date()));
                        log.put("attackType", "TCP SYN Flood");
                        log.put("delay", "10s");
                        log.put("status", "Đang xử lý...");
                        evaluationLogs.add(log);

                        // Tạo cảnh báo cho control panel
                        Map<String, String> alert = new ConcurrentHashMap<>();
                        alert.put("time", String.valueOf(System.currentTimeMillis()));
                        alert.put("ip", targetIp);
                        alert.put("attackType", "TCP SYN Flood");
                        alert.put("message", "SYN Flood attack is occurred!");

                        alertHistory.add(alert);

                        logger.error("[VERIFICATION SYSTEM]: SYN Flood attack is occurred at {}!", targetIp);
                        logger.warn("The system will automatically activate the Iptables shield after 10 seconds...");

                        // Kích hoạt hệ thống phản công
                        CompletableFuture.runAsync(() -> {
                            // Gọi hàm bắn lệnh SET sang Agent
                            boolean success = triggerMitigationSet(targetIp);

                            // Lấy chỉ số hệ thống "đỉnh điểm" ngay lúc Iptables vừa được bật
                            Map<String, Object> currentMetrics = pollerService.getMetricsByIp(targetIp);

                            // Cập nhật lại các thông số vào log
                            log.put("endTime", new SimpleDateFormat("HH:mm:ss").format(new Date()));
                            log.put("minBandwidth", currentMetrics.getOrDefault("downKbps", "0") + " Kbps");
                            log.put("maxPps", currentMetrics.getOrDefault("inPps", "0")); // Tạm dùng upKbps làm PPS
                            log.put("maxCpu", currentMetrics.getOrDefault("cpu", "0") + "%");
                            log.put("maxRam", currentMetrics.getOrDefault("ram", "0") + "%");
                            log.put("maxTcp", currentMetrics.getOrDefault("tcp", "0"));
                            log.put("status", success ? "Đã chặn" : "Thất bại");

                        }, CompletableFuture.delayedExecutor(currentDelay, TimeUnit.SECONDS)); // Đếm ngược 10s mới kích
                                                                                               // hoạt đánh chặn
                    }
                });
            }
        }
    }

    // Hàm chức năng: Đóng gói và bắn lệnh SET
    public boolean triggerMitigationSet(String targetIp) {
        logger.info("[+] ACTION: Sending SNMP SET to {} to activate defense...", targetIp);
        try {
            // Mở cổng mạng gửi đi
            TransportMapping<? extends Address> transport = new DefaultUdpTransportMapping();
            transport.listen();
            Snmp snmp = new Snmp(transport);

            // Cấu hình đích đến Agent qua cổng 161
            Address targetAddress = GenericAddress.parse("udp:" + targetIp + "/" + SET_TARGET_PORT);

            CommunityTarget target = new CommunityTarget();
            target.setCommunity(new OctetString(RW_COMMUNITY));
            target.setAddress(targetAddress);
            target.setRetries(1);
            target.setTimeout(2000);
            target.setVersion(SnmpConstants.version2c);

            // Tạo gói tin định dạng SET
            PDU pdu = new PDU();
            pdu.setType(PDU.SET);

            // Gắn OID của script và ném vào giá trị 1 (kích hoạt điều kiện trong script
            // Bash của Agent)
            pdu.add(new VariableBinding(new OID(SCRIPT_TRIGGER_OID), new Integer32(1)));

            // Gửi đi và lấy phản hồi
            ResponseEvent responseEvent = snmp.send(pdu, target);
            PDU responsePDU = responseEvent.getResponse();

            // Phân tích kết quả
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

    public List<Map<String, Object>> getEvaluationLogs() {
        return evaluationLogs;
    }

    public List<Map<String, String>> getAlertHistory() {
        return alertHistory;
    }
}