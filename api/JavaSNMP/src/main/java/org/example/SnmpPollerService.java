// SnmpPollerService.java: Module sử dụng SNMP GET để quét dữ liệu định kỳ (Polling) và tính toán hiệu năng từ máy Agent.
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
    private List<String> targetIps = new CopyOnWriteArrayList<>(); // Danh sách IP Agent đang được giám sát
    private static final Logger logger = LoggerFactory.getLogger(SnmpPollerService.class);

    private Snmp snmp; // Đối tượng SNMP4J được tái sử dụng cho mọi polling
    private static final int SNMP_PORT = 161; // Cổng SNMP mặc định
    private static final String RO_COMMUNITY = "public"; // Community string read-only, phải khớp snmpd.conf

    // CÁC OID CẦN LẤY TỪ AGENT (chuẩn MIB-II + UCD-SNMP)
    // ifInOctets / ifOutOctets: số byte đến/ra interface
    private static final String OID_IN_OCTETS = "1.3.6.1.2.1.2.2.1.10.2";
    private static final String OID_OUT_OCTETS = "1.3.6.1.2.1.2.2.1.16.2";

    // ifInUcastPkts / ifOutUcastPkts: số gói tin đến/ra interface
    private static final String OID_IN_PKTS = "1.3.6.1.2.1.2.2.1.11.2";
    private static final String OID_OUT_PKTS = "1.3.6.1.2.1.2.2.1.17.2";

    // ssCpuIdle (UCD): % thời gian CPU nhàn rỗi
    private static final String OID_CPU_IDLE = "1.3.6.1.4.1.2021.11.11.0";

    // memTotalReal / memAvailReal (UCD): tổng và còn trống bộ nhớ RAM (KB)
    private static final String OID_RAM_TOTAL = "1.3.6.1.4.1.2021.4.5.0";
    private static final String OID_RAM_AVAIL = "1.3.6.1.4.1.2021.4.6.0";

    // tcpCurrEstab: số kết nối TCP đang ở trạng thái ESTABLISHED (cảm biến phát hiện tấn công SYN Flood)
    private static final String OID_TCP_CURR = "1.3.6.1.2.1.6.9.0";

    // sysDescr: mô tả hệ điều hành Agent
    private static final String OID_SYS_DESCR = "1.3.6.1.2.1.1.1.0";

    // VmState: lưu giá trị đếm của lần polling trước để tính tốc độ (delta) giữa hai lần quét
    private class VmState {
        long lastInBytes = 0; // Số byte đện lần cuối (tham chiếu tính delta)
        long lastOutBytes = 0; // Số byte đi lần cuối
        long lastInPkts = 0; // Số gói đện lần cuối
        long lastOutPkts = 0; // Số gói đi lần cuối
        long lastTime = 0; // Thời điểm polling lần cuối (ms)
    }

    // Bản đồ trạng thái theo IP
    private Map<String, VmState> states = new ConcurrentHashMap<>();

    // Bản đồ lưu trữ số liệu Metrics mới nhất của từng IP -> được API trả xuống FE
    private Map<String, Map<String, Object>> allMetrics = new ConcurrentHashMap<>();

    // Khởi tạo dịch vụ SNMP, lắng nghe cổng UDP và tự động thêm 2 VM mặc định vào danh sách giám sát.
    @PostConstruct
    public void init() {
        try {
            // Tạo kênh truyền UDP
            TransportMapping<? extends Address> transport = new DefaultUdpTransportMapping();
            transport.listen();

            // Tạo đối tượng SNMP
            snmp = new Snmp(transport);

            // Thêm IP Agent cần giám sát
            addDevice("10.0.1.2");
            addDevice("10.0.2.2");

            logger.info("✅ NMS POLLER: Started Multi-Agent Polling Service!");
        } catch (IOException e) {
            logger.error("❌ SNMP Poller Initialization Error: ", e);
        }
    }

    // Thêm IP mới vào danh sách cần giám sát (thông qua API hoặc tự động).
    public void addDevice(String ip) {
        if (!targetIps.contains(ip)) {
            targetIps.add(ip);
            states.put(ip, new VmState());
            logger.info("🖥️ Added new Agent to monitor: {}", ip);
        }
    }

    // Tự động được gọi ngầm mỗi 3 giây (Cronjob) để quét dữ liệu của toàn bộ các Agent hiện có.
    @Scheduled(fixedRate = 3000)
    public void pollAllMetrics() {
        for (String ip : targetIps) {
            pollSingleVm(ip);
        }
    }

    // Gửi SNMP GET yêu cầu trực tiếp tới 1 Agent để lấy CPU, RAM, Băng thông, TCP, v.v. và tính toán throughput.
    private void pollSingleVm(String ip) {
        try {
            // Tạo địa chỉ đích đến máy Agent
            Address targetAddress = GenericAddress.parse("udp:" + ip + "/" + SNMP_PORT);

            // Tạo CommunityTarget (cấu hình thông tin xác thực)
            CommunityTarget target = new CommunityTarget();
            target.setCommunity(new OctetString(RO_COMMUNITY)); // Sử dụng community string "public" đã cấu hình trên Agent
            target.setAddress(targetAddress);
            target.setRetries(1);
            target.setTimeout(1500);
            target.setVersion(SnmpConstants.version2c);

            // Tạo PDU (Protocol Data Unit) để gửi yêu cầu
            PDU pdu = new PDU();

            // Thứ tự thêm OID vào PDU phải khớp với thứ tự đọc response ở bên dưới (index 0–8)
            pdu.add(new VariableBinding(new OID(OID_IN_OCTETS))); // [0] byte đện tới (cứng dồn)
            pdu.add(new VariableBinding(new OID(OID_OUT_OCTETS))); // [1] byte đi ra  (cứng dồn)
            pdu.add(new VariableBinding(new OID(OID_IN_PKTS))); // [2] gói đện (cứng dồn)
            pdu.add(new VariableBinding(new OID(OID_OUT_PKTS))); // [3] gói đi  (cứng dồn)
            pdu.add(new VariableBinding(new OID(OID_CPU_IDLE))); // [4] % CPU nhàn
            pdu.add(new VariableBinding(new OID(OID_RAM_TOTAL))); // [5] tổng RAM (KB)
            pdu.add(new VariableBinding(new OID(OID_RAM_AVAIL))); // [6] RAM còn trống (KB)
            pdu.add(new VariableBinding(new OID(OID_TCP_CURR))); // [7] số TCP ESTABLISHED
            pdu.add(new VariableBinding(new OID(OID_SYS_DESCR))); // [8] mô tả OS
            pdu.setType(PDU.GET); // GET: lấy chính xác các OID đã liệt kê (không WALK)

            // Gửi PDU và nhận response
            ResponseEvent responseEvent = snmp.send(pdu, target);
            PDU responsePDU = responseEvent.getResponse();

            // Tạo bản đồ lưu trữ số liệu Metrics mới nhất của từng IP
            Map<String, Object> metrics = new ConcurrentHashMap<>();

            // Kiểm tra response có hợp lệ không
            if (responsePDU != null && responsePDU.getErrorStatus() == PDU.noError) {
                // Đọc giá trị thô theo thứ tự đã add vào PDU bên trên
                String inBytesStr = responsePDU.getVariableBindings().get(0).getVariable().toString();
                String outBytesStr = responsePDU.getVariableBindings().get(1).getVariable().toString();
                String inPktsStr = responsePDU.getVariableBindings().get(2).getVariable().toString();
                String outPktsStr = responsePDU.getVariableBindings().get(3).getVariable().toString();
                String cpuIdleStr = responsePDU.getVariableBindings().get(4).getVariable().toString();
                String ramTotalStr = responsePDU.getVariableBindings().get(5).getVariable().toString();
                String ramAvailStr = responsePDU.getVariableBindings().get(6).getVariable().toString();
                String tcpCurrStr = responsePDU.getVariableBindings().get(7).getVariable().toString();
                String sysDescrStr = responsePDU.getVariableBindings().get(8).getVariable().toString();

                // Nếu interface 2 không tồn tại trên Agent, bỏ qua lần poll này
                if (inBytesStr.equals("noSuchObject"))
                    return;

                // Trích xuất tên OS
                String sysName = "Unknown OS";
                if (!sysDescrStr.equals("noSuchObject")) {
                    String[] parts = sysDescrStr.split(" ");
                    if (parts.length >= 2) {
                        sysName = parts[0] + " " + parts[1]; // Lấy 2 phần đầu: "Linux snmp-vm1..."
                    } else {
                        sysName = sysDescrStr;
                    }
                }

                // Tính CPU: ssCpuIdle trả về % rảnh -> CPU sử dụng = 100 - idle
                long cpuUsage = 100 - Long.parseLong(cpuIdleStr);

                // Tính % RAM: (tổng - còn lại) / tổng * 100
                long ramTotal = Long.parseLong(ramTotalStr);
                long ramAvail = Long.parseLong(ramAvailStr);
                double ramUsage = ((double) (ramTotal - ramAvail) / ramTotal) * 100;

                // Lấy những giá trị thô cần thiết
                long tcpConns = Long.parseLong(tcpCurrStr); // Số kết nối TCP hiện tại
                long currentInBytes = Long.parseLong(inBytesStr); // Bytes in
                long currentOutBytes = Long.parseLong(outBytesStr); // Bytes out
                long currentInPkts = Long.parseLong(inPktsStr); // Packets in
                long currentOutPkts = Long.parseLong(outPktsStr); // Packets out

                // Lấy thời gian hiện tại
                long currentTime = System.currentTimeMillis();

                // Khởi tạo băng thông = 0 (sử dụng cho lần poll đầu tiên chưa có delta)
                long inKbps = 0, outKbps = 0, inPps = 0, outPps = 0;
                VmState state = states.get(ip); // Lấy trạng thái lần poll trước

                if (state.lastTime != 0) { // Bỏ qua lần đầu tiên (chưa có điểm so sánh)
                    long diffTimeSeconds = (currentTime - state.lastTime) / 1000;
                    if (diffTimeSeconds > 0) {
                        // Công thức tính Kbps: delta_bytes * 8 bit/byte / giây / 1024 byte/KB
                        inKbps = ((currentInBytes - state.lastInBytes) * 8) / diffTimeSeconds / 1024;
                        outKbps = ((currentOutBytes - state.lastOutBytes) * 8) / diffTimeSeconds / 1024;

                        // Công thức tính PPS: delta_packet / giây
                        inPps = (currentInPkts - state.lastInPkts) / diffTimeSeconds;
                        outPps = (currentOutPkts - state.lastOutPkts) / diffTimeSeconds;
                    }
                }

                // Cập nhật trạng thái lần poll hiện tại
                state.lastInBytes = currentInBytes;
                state.lastOutBytes = currentOutBytes;
                state.lastInPkts = currentInPkts;
                state.lastOutPkts = currentOutPkts;
                state.lastTime = currentTime;

                // Lưu trữ toàn bộ dữ liệu chỉ số vào map
                metrics.put("cpu", cpuUsage);
                metrics.put("ram", Math.round(ramUsage * 100.0) / 100.0);
                metrics.put("downKbps", inKbps);
                metrics.put("upKbps", outKbps);
                metrics.put("inPps", inPps);
                metrics.put("outPps", outPps);
                metrics.put("tcp", tcpConns);
                metrics.put("sysName", sysName);
                metrics.put("status", "ONLINE");

                // In thông tin ra log
                logger.info(
                        "[{}] OS: {} | CPU: {}% | RAM: {}% | Down: {} Kbps | Up: {} Kbps | In: {} pps | Out: {} pps | TCP: {}",
                        ip, sysName, cpuUsage, String.format("%.1f", ramUsage), inKbps, outKbps, inPps, outPps,
                        tcpConns);
            } else {
                metrics.put("status", "OFFLINE");
            }
            allMetrics.put(ip, metrics);

        } catch (Exception e) {
            logger.error("❌ Error polling data from {}: {}", ip, e.getMessage());
        }
    }

    // Trả về toàn bộ dữ liệu chỉ số (Metrics) đang lưu trong RAM để API gửi đến FE.
    public Map<String, Map<String, Object>> getAllMetrics() {
        return allMetrics;
    }

    // Tra cứu Metrics của 1 IP cụ thể (dùng bởi TrapReceiverService để đếm số liệu trong log đánh giá)
    public Map<String, Object> getMetricsByIp(String ip) {
        return allMetrics.getOrDefault(ip, new ConcurrentHashMap<>());
    }
}