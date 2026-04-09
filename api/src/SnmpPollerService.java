
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
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Service
public class SnmpPollerService {
    private static final Logger logger = LoggerFactory.getLogger(SnmpPollerService.class);

    // Cấu hình kết nối tới snmp agent
    private static final String VM1_IP = "10.0.1.2"; // IP nội bộ của máy Agent
    private static final int SNMP_PORT = 161; // Cổng của dịch vụ SNMP GET/SET
    private static final String RO_COMMUNITY = "public"; // Community string quyền Đọc

    // Khai báo oid cần thu tập
    private static final String OID_IN_OCTETS = "1.3.6.1.2.1.2.2.1.10.2"; // Tổng số Bytes tải xuống (Download)
    private static final String OID_OUT_OCTETS = "1.3.6.1.2.1.2.2.1.16.2"; // Tổng số Bytes tải lên (Upload)
    private static final String OID_IN_PKTS = "1.3.6.1.2.1.2.2.1.11.2"; // Tổng số Gói tin đi vào (In PPS)
    private static final String OID_OUT_PKTS = "1.3.6.1.2.1.2.2.1.17.2"; // Tổng số Gói tin đi ra (Out PPS)
    private static final String OID_CPU_IDLE = "1.3.6.1.4.1.2021.11.11.0"; // Phần trăm CPU đang rảnh
    private static final String OID_RAM_TOTAL = "1.3.6.1.4.1.2021.4.5.0"; // Tổng dung lượng RAM (KB)
    private static final String OID_RAM_AVAIL = "1.3.6.1.4.1.2021.4.6.0"; // RAM còn trống thực tế (KB)
    private static final String OID_TCP_CURR = "1.3.6.1.2.1.6.9.0"; // Số lượng kết nối TCP đang mở

    // Lưu trữ trạng thái trước đó
    private long lastInBytes = 0;
    private long lastOutBytes = 0;
    private long lastInPkts = 0;
    private long lastOutPkts = 0;
    private long lastTime = 0;

    private Snmp snmp;
    private CommunityTarget target;

    private Map<String, Object> latestMetrics = new ConcurrentHashMap<>();

    // Chạy ngay sau khi Spring Boot khởi động
    @PostConstruct
    public void init() {
        try {
            // Mở một cổng UDP ngẫu nhiên trên máy SNMP Manage để gửi/nhận truy vấn
            TransportMapping<? extends Address> transport = new DefaultUdpTransportMapping();
            transport.listen();
            snmp = new Snmp(transport);

            // Cấu hình đích đến (Target) tới máy SNMP Agent
            Address targetAddress = GenericAddress.parse("udp:" + VM1_IP + "/" + SNMP_PORT);
            target = new CommunityTarget();
            target.setCommunity(new OctetString(RO_COMMUNITY));
            target.setAddress(targetAddress);
            target.setRetries(1);
            target.setTimeout(1500);
            target.setVersion(SnmpConstants.version2c); // Chọn giao thức SNMPv2

            logger.info("✅ NMS POLLER: Start sampling data from VM1({}) every 5 seconds...", VM1_IP);
        } catch (IOException e) {
            logger.error("❌ SNMP Poller Initialization Error: ", e);
        }
    }

    // Vòng lặp tự động chạy mỗi 5s
    @Scheduled(fixedRate = 5000)
    public void pollVm1Metrics() {
        try {
            // Khởi tạo một Gói tin PDU chuẩn bị gửi đi
            PDU pdu = new PDU();

            // Đóng gói 8 câu hỏi (OID) vào chung 1 gói PDU để tiết kiệm băng thông mạng
            pdu.add(new VariableBinding(new OID(OID_IN_OCTETS)));
            pdu.add(new VariableBinding(new OID(OID_OUT_OCTETS)));
            pdu.add(new VariableBinding(new OID(OID_IN_PKTS)));
            pdu.add(new VariableBinding(new OID(OID_OUT_PKTS)));
            pdu.add(new VariableBinding(new OID(OID_CPU_IDLE)));
            pdu.add(new VariableBinding(new OID(OID_RAM_TOTAL)));
            pdu.add(new VariableBinding(new OID(OID_RAM_AVAIL)));
            pdu.add(new VariableBinding(new OID(OID_TCP_CURR)));
            pdu.setType(PDU.GET); // Sử dụng GET để đọc dữ liệu

            // Bắn gói tin đi và nhận phản hồi trả về
            ResponseEvent responseEvent = snmp.send(pdu, target);
            PDU responsePDU = responseEvent.getResponse();

            // Nếu Agent có trả lời và không báo lỗi
            if (responsePDU != null && responsePDU.getErrorStatus() == PDU.noError) {
                // Rút trích dữ liệu thô (Text) dựa vào đúng thứ tự Index đã nhồi vào lúc trước
                String inBytesStr = responsePDU.getVariableBindings().get(0).getVariable().toString();
                String outBytesStr = responsePDU.getVariableBindings().get(1).getVariable().toString();
                String inPktsStr = responsePDU.getVariableBindings().get(2).getVariable().toString();
                String outPktsStr = responsePDU.getVariableBindings().get(3).getVariable().toString();
                String cpuIdleStr = responsePDU.getVariableBindings().get(4).getVariable().toString();
                String ramTotalStr = responsePDU.getVariableBindings().get(5).getVariable().toString();
                String ramAvailStr = responsePDU.getVariableBindings().get(6).getVariable().toString();
                String tcpCurrStr = responsePDU.getVariableBindings().get(7).getVariable().toString();

                // Kiểm tra lỗi phân quyền View trên Agent
                if(inBytesStr.equals("noSuchObject") || cpuIdleStr.equals("noSuchObject")) {
                    logger.error("❌ OID Error: You need to check the snmpd.conf view on VM1!");
                    return;
                }

                // Tính % sử dụng CPU
                long cpuIdle = Long.parseLong(cpuIdleStr);
                long cpuUsage = 100 - cpuIdle;

                // Tính % sử dụng RAM
                long ramTotal = Long.parseLong(ramTotalStr);
                long ramAvail = Long.parseLong(ramAvailStr);
                double ramUsage = ((double)(ramTotal - ramAvail) / ramTotal) * 100;

                // Tính số lượng kết nối TCP
                long tcpConns = Long.parseLong(tcpCurrStr);

                long currentInBytes = Long.parseLong(inBytesStr);
                long currentOutBytes = Long.parseLong(outBytesStr);
                long currentInPkts = Long.parseLong(inPktsStr);
                long currentOutPkts = Long.parseLong(outPktsStr);
                long currentTime = System.currentTimeMillis();

                long inKbps = 0, outKbps = 0, inPps = 0, outPps = 0;

                if (lastTime != 0) {
                    long diffTimeSeconds = (currentTime - lastTime) / 1000;
                    if (diffTimeSeconds > 0) {
                        // Tính Băng thông: (Số Bytes lệch * 8 bits) / Số giây / 1024 = Kbps
                        inKbps = ((currentInBytes - lastInBytes) * 8) / diffTimeSeconds / 1024;
                        outKbps = ((currentOutBytes - lastOutBytes) * 8) / diffTimeSeconds / 1024;

                        // Tính PPS: (Số Gói tin lệch) / Số giây = Packets per second
                        inPps = (currentInPkts - lastInPkts) / diffTimeSeconds;
                        outPps = (currentOutPkts - lastOutPkts) / diffTimeSeconds;
                    }
                }

                // Lưu lại dữ liệu hiện tại
                lastInBytes = currentInBytes;
                lastOutBytes = currentOutBytes;
                lastInPkts = currentInPkts;
                lastOutPkts = currentOutPkts;
                lastTime = currentTime;

                // Đóng gói dữ liệu để cung cấp cho API
                latestMetrics.put("cpu", cpuUsage);
                latestMetrics.put("ram", Math.round(ramUsage * 100.0) / 100.0);
                latestMetrics.put("downKbps", inKbps);
                latestMetrics.put("upKbps", outKbps);
                latestMetrics.put("inPps", inPps);
                latestMetrics.put("outPps", outPps);
                latestMetrics.put("tcp", tcpConns);
                latestMetrics.put("status", "ONLINE");

                logger.info(String.format("[VM1] CPU: %d%% | RAM: %.1f%% | Down: %d Kbps | Up: %d Kbps | In: %d pps | Out: %d pps | TCP: %d",
                        cpuUsage, ramUsage, inKbps, outKbps, inPps, outPps, tcpConns));
            } else {
                logger.warn("❌ VM1 timeout or unresponsive to SNMP GET!");
                latestMetrics.put("status", "OFFLINE");
            }
        } catch (Exception e) {
            logger.error("❌ Error when polling data: ", e);
            latestMetrics.put("status", "ERROR");
        }
    }

    public Map<String, Object> getLatestMetrics() {
        return latestMetrics;
    }
}