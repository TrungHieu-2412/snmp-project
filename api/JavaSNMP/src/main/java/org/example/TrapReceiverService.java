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

    // Lắng nghe TRAP trên tất cả các interface (0.0.0.0), sử dụng cổng 10162 thay cho cổng 162 (yêu cầu quyền root)
    private static final String TRAP_LISTEN_ADDRESS = "0.0.0.0/10162";

    // Community string read-write Agent dùng để kiểm tra quyền ghi khi nhận SNMP SET
    private static final String RW_COMMUNITY = "private_admin";
    private static final String SET_TARGET_PORT = "161";

    // OID tùy chỉnh: được định nghĩa trên Agent, khi SET giá trị 1 sẽ kích hoạt script iptables chặn tấn công
    private static final String SCRIPT_TRIGGER_OID = "1.3.6.1.4.1.9999.1.0";

    // Service Poller để lấy số liệu từ Agent
    @Autowired
    private SnmpPollerService pollerService;

    // Danh sách cảnh báo TRAP (alert) đã nhận
    private List<Map<String, String>> alertHistory = new ArrayList<>();

    // Nhật ký đánh giá: mỗi đợt tấn công tạo 1 bản ghi gồm các thông số đo đạc trước/sau chặn
    private List<Map<String, Object>> evaluationLogs = new ArrayList<>();
    private int logIdCounter = 1; // ID tăng dần cho mỗi bản ghi log (dùng làm key trong bảng FE)

    private int mitigationDelay = 10; // Thời gian delay trước khi chặn (giây)
    private boolean isAutoMode = true; // true = Auto-IPS tự chặn, false = chờ thủ công

    // Cờ theo dõi trạng thái chặn để triệt tiêu "Bóng ma TRAP"
    private ConcurrentHashMap<String, Boolean> activeMitigations = new ConcurrentHashMap<>();

    // Cấu hình cổng lắng nghe TRAP (10162) để nhận các cảnh báo từ Agent đẩy về.
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

    // Được gọi tự động mỗi khi Agent gửi một TRAP thông báo có tấn công mạng (SYN Flood).
    @Override
    public void processPdu(CommandResponderEvent event) {
        if (event.getPDU() != null) {
            String peerAddress = event.getPeerAddress().toString(); // IP:port của Agent gửi TRAP
            int pduType = event.getPDU().getType();

            // Chỉ xử lý TRAP v2 (PDU.TRAP) hoặc TRAP v1 (PDU.V1TRAP), bỏ qua các PDU khác
            if (pduType == PDU.TRAP || pduType == PDU.V1TRAP) {

                // Duyệt qua tất cả các Variable Binding trong TRAP để tìm giá trị đáng nghi vấn
                event.getPDU().getVariableBindings().forEach(vb -> {
                    String value = vb.getVariable().toString();

                    // Nếu payload chứa chuỗi "SYN_FLOOD_DETECTED", xác nhận là tấn công thật
                    if (value.contains("SYN_FLOOD_DETECTED")) {
                        String targetIp = peerAddress.split("/")[0]; // Trích xuất chỉ phần IP (bỏ port)

                        // Nếu IP này đang được đếm ngược hoặc xử lý rồi -> Vứt bỏ TRAP này!
                        if (activeMitigations.getOrDefault(targetIp, false)) {
                            return;
                        }

                        // Đánh dấu IP này bắt đầu được đưa vào quy trình xử lý (Khóa)
                        activeMitigations.put(targetIp, true);

                        logger.warn("⚠️ SECURITY WARNING: Received TRAP packet from [{}]", peerAddress);
                        int currentDelay = this.mitigationDelay; // Chụp lại delay hiện tại (tránh race condition)

                        // Tạo bản ghi đánh giá (EvaluationLog): ghi lại thời gian bắt đầu, loại tấn công, delay
                        Map<String, Object> log = new ConcurrentHashMap<>();
                        log.put("key", String.valueOf(logIdCounter++));
                        log.put("startTime", new SimpleDateFormat("HH:mm:ss").format(new Date()));
                        log.put("attackType", "TCP SYN Flood");
                        log.put("delay", currentDelay + "s");
                        log.put("status", "Processing...");
                        evaluationLogs.add(log);

                        // Tạo cảnh báo (Alert)
                        Map<String, String> alert = new ConcurrentHashMap<>();
                        alert.put("time", String.valueOf(System.currentTimeMillis()));
                        alert.put("ip", targetIp);
                        alert.put("attackType", "TCP SYN Flood");
                        alert.put("message", "SYN Flood attack is occurred!");
                        alertHistory.add(alert);

                        logger.error("[VERIFICATION SYSTEM]: SYN Flood attack is occurred at {}!", targetIp);

                        // Chế độ tự động
                        if (isAutoMode) {
                            logger.warn(
                                    "⌛ The system will automatically activate the Iptables shield after {} seconds...",
                                    currentDelay);

                            // Chạy task chặn bất đồng bộ sau "currentDelay" giây
                            CompletableFuture.runAsync(() -> {
                                boolean success = triggerMitigationSet(targetIp); // Gửi SNMP SET

                                // Thu thập số liệu thực tế tại thời điểm sau chặn để lưu vào log đánh giá
                                Map<String, Object> currentMetrics = pollerService.getMetricsByIp(targetIp);

                                log.put("endTime", new SimpleDateFormat("HH:mm:ss").format(new Date()));
                                log.put("minBandwidth", currentMetrics.getOrDefault("downKbps", "0") + " Kbps");
                                log.put("maxPps", currentMetrics.getOrDefault("inPps", "0"));
                                log.put("maxCpu", currentMetrics.getOrDefault("cpu", "0") + "%");
                                log.put("maxRam", currentMetrics.getOrDefault("ram", "0") + "%");
                                log.put("maxTcp", currentMetrics.getOrDefault("tcp", "0"));
                                log.put("status", success ? "Resolved" : "Failed");

                                // Cập nhật trạng thái cho Alert
                                if (success) {
                                    alert.put("status", "Resolved");
                                }

                                // Gỡ bỏ cờ khóa để hệ thống có thể nhận TRAP lần tiếp theo sau 15s.
                                CompletableFuture.delayedExecutor(15, TimeUnit.SECONDS).execute(() -> {
                                    activeMitigations.put(targetIp, false);
                                });

                            }, CompletableFuture.delayedExecutor(currentDelay, TimeUnit.SECONDS));
                        } else {
                            // Chế độ Thủ công: chỉ log cảnh báo, không tự gửi SET
                            logger.warn("⚠️ Auto-IPS is Disabled. Waiting for manual intervention...");
                            log.put("status", "Manual Pending");
                            alert.put("status", "Processing...");

                            // Trong chế độ thủ công, cũng giải phóng khóa sau 30 giây
                            CompletableFuture.delayedExecutor(30, TimeUnit.SECONDS).execute(() -> {
                                activeMitigations.put(targetIp, false);
                            });
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
            // Tạo SNMP session mới (không tái dùng session polling để tránh xung đột luồng)
            TransportMapping<? extends Address> transport = new DefaultUdpTransportMapping();
            transport.listen();
            Snmp snmp = new Snmp(transport);
            Address targetAddress = GenericAddress.parse("udp:" + targetIp + "/" + SET_TARGET_PORT);

            // Dùng community read-write (private_admin)
            CommunityTarget target = new CommunityTarget();
            target.setCommunity(new OctetString(RW_COMMUNITY));
            target.setAddress(targetAddress);
            target.setRetries(1);
            target.setTimeout(1500);
            target.setVersion(SnmpConstants.version2c);

            PDU pdu = new PDU();
            pdu.setType(PDU.SET); // PDU.SET: ghi đè giá trị OID trên Agent

            // SET OID = 1 -> Agent nhận được sẽ chạy script kích hoạt iptables
            pdu.add(new VariableBinding(new OID(SCRIPT_TRIGGER_OID), new Integer32(1)));

            // Nhận phản hồi từ Agent
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

    // Hàm hỗ trợ cập nhật cấu hình độ trễ Delay (phục vụ mục đích đánh giá hiệu năng) từ FE đẩy xuống.
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

    // Lấy danh sách lịch sử cảnh báo tấn công để hiển thị lên bảng điều khiển FE.
    public List<Map<String, String>> getAlertHistory() {
        return alertHistory;
    }
}