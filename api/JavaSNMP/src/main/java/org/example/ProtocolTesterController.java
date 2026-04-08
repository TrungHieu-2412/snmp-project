// ProtocolTesterController.java: Benchmark so sánh hiệu năng SNMPv1, v2c, v3.
package org.example;

import org.snmp4j.CommunityTarget;
import org.snmp4j.PDU;
import org.snmp4j.ScopedPDU;
import org.snmp4j.Snmp;
import org.snmp4j.TransportMapping;
import org.snmp4j.UserTarget;
import org.snmp4j.event.ResponseEvent;
import org.snmp4j.mp.MPv3;
import org.snmp4j.mp.SnmpConstants;
import org.snmp4j.security.*;
import org.snmp4j.smi.*;
import org.snmp4j.transport.DefaultUdpTransportMapping;
import org.snmp4j.transport.TransportListener;
import org.snmp4j.TransportStateReference;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.nio.ByteBuffer;

@RestController
@RequestMapping("/api/benchmark")
@CrossOrigin(origins = "*")
public class ProtocolTesterController {
    // Thông tin xác thực SNMPv3 (phải tạo user này trước trên Agent bằng net-snmp)
    private static final String V3_USER = "adminv3"; // Tên user USM
    private static final String V3_AUTH_PASS = "admin12345"; // Mật khẩu xác thực SHA-1
    private static final String V3_PRIV_PASS = "admin12345"; // Mật khẩu mã hóa AES-128

    private static final String COMMUNITY = "public"; // Community string dùng cho SNMPv1/v2c (read-only), phải khớp với snmpd.conf trên Agent
    private static final String START_OID = "1.3.6.1.2.1.2.2.1.10"; // OID gốc để bắt đầu bài test: ifInOctets

    // Thực thi giả lập bài test gửi 50 gói tin liên tục để đo đạc và so sánh tốc độ
    // sinh thái của 3 chuẩn SNMP (v1, v2c, v3).
    @GetMapping("/run")
    public ResponseEntity<?> runBenchmark(@RequestParam("ip") String targetIp) {
        if (!"10.0.1.2".equals(targetIp)) {
            return ResponseEntity.status(403).body("Warning: Feature 'SNMPv3 Benchmark' is not configured on Agent " + targetIp + ". Please select Agent 10.0.1.2.");
        }

        List<Map<String, Object>> results = new ArrayList<>();

        try {
            // Tạo kênh truyền UDP (không gắn port cụ thể, dùng cổng ngẫu nhiên phía client)
            TransportMapping<? extends Address> transport = new DefaultUdpTransportMapping();
            Snmp snmp = new Snmp(transport);

            // Khởi tạo USM (User Security Model) để hỗ trợ SNMPv3
            USM usm = new USM(SecurityProtocols.getInstance(), new OctetString(MPv3.createLocalEngineID()), 0);
            SecurityModels.getInstance().addSecurityModel(usm);

            // Đăng ký user SNMPv3 với giao thức Auth=SHA, Privacy=AES128
            snmp.getUSM().addUser(new OctetString(V3_USER),
                    new UsmUser(new OctetString(V3_USER),
                            AuthSHA.ID, new OctetString(V3_AUTH_PASS),
                            PrivAES128.ID, new OctetString(V3_PRIV_PASS)));

            // Bắt đầu lắng nghe phản hồi UDP từ Agent
            transport.listen();
            Address targetAddress = GenericAddress.parse("udp:" + targetIp + "/161");

            // SNMPv1: GETNEXT tuần tự
            // CommunityTarget = đích đến dùng Community string (không mã hóa)
            CommunityTarget targetV1 = new CommunityTarget();
            targetV1.setCommunity(new OctetString(COMMUNITY));
            targetV1.setAddress(targetAddress);
            targetV1.setRetries(1);
            targetV1.setTimeout(1500);
            targetV1.setVersion(SnmpConstants.version1);

            long startV1 = System.currentTimeMillis(); // Bắt đầu đếm giờ
            OID currentOid = new OID(START_OID); // OID hiện tại để GETNEXT
            int v1Requests = 0; // Đếm số gói UDP đã gửi
            int v1OidsRetrieved = 0; // Đếm số OID thực tế nhận được trong response

            // SNMPv1 không có GETBULK -> phải lặp 50 lần GETNEXT (mỗi lần = 1 gói UDP riêng)
            for (int i = 0; i < 50; i++) {
                // Khởi tạo PDU để gửi yêu cầu GETNEXT
                PDU pduV1 = new PDU();
                pduV1.add(new VariableBinding(currentOid)); // Thêm OID vào PDU
                pduV1.setType(PDU.GETNEXT); // GETNEXT: lấy OID liền kề tiếp theo trong MIB

                // Gửi PDU và nhận response
                ResponseEvent responseV1 = snmp.send(pduV1, targetV1);
                v1Requests++; // Đếm số gói UDP đã gửi

                // Kiểm tra response có hợp lệ không
                if (responseV1 != null && responseV1.getResponse() != null) {
                    v1OidsRetrieved += responseV1.getResponse().getVariableBindings().size(); // Đếm số OID thực tế nhận được trong response
                    currentOid = responseV1.getResponse().get(0).getOid(); // Chuyển sang OID tiếp theo
                }
            }
            // Tính toán thời gian và throughput cho SNMPv1
            long timeV1 = System.currentTimeMillis() - startV1; // Tổng thời gian (ms)
            long throughputV1 = timeV1 > 0 ? (v1OidsRetrieved * 1000L) / timeV1 : 0; // Throughput = số OID nhận được / thời gian (quy về giây)

            // SNMPv2c: GETBULK (1 gói duy nhất lấy ≤50 OID)
            CommunityTarget targetV2c = new CommunityTarget();
            targetV2c.setCommunity(new OctetString(COMMUNITY)); // Community string plaintext (giống v1)
            targetV2c.setAddress(targetAddress);
            targetV2c.setRetries(1);
            targetV2c.setTimeout(1500);
            targetV2c.setVersion(SnmpConstants.version2c);

            long startV2c = System.currentTimeMillis();
            PDU pduV2c = new PDU();
            pduV2c.setType(PDU.GETBULK); // GETBULK: tính năng mới của v2c
            pduV2c.setMaxRepetitions(50); // Yêu cầu trả về tối đa 50 OID trong 1 response
            pduV2c.setNonRepeaters(0); // Không có OID đặc biệt nào cần lấy 1 lần
            pduV2c.add(new VariableBinding(new OID(START_OID)));

            // Gửi PDU, nhận response và đếm số OID thực nhận
            int v2cOidsRetrieved = 0;
            ResponseEvent responseV2c = snmp.send(pduV2c, targetV2c);
            if (responseV2c != null && responseV2c.getResponse() != null) {
                v2cOidsRetrieved = responseV2c.getResponse().getVariableBindings().size();
            }

            // Tính toán thời gian và throughput cho SNMPv2
            long timeV2c = System.currentTimeMillis() - startV2c;
            long throughputV2c = timeV2c > 0 ? (v2cOidsRetrieved * 1000L) / timeV2c : 0;

            // SNMPv3: GETBULK + Xác thực SHA + Mã hóa AES128
            // UserTarget (khác CommunityTarget): dùng USM với user/password thay vì community
            UserTarget targetV3 = new UserTarget();
            targetV3.setAddress(targetAddress);
            targetV3.setRetries(1);
            targetV3.setTimeout(1500);
            targetV3.setVersion(SnmpConstants.version3);

            // AUTH_PRIV = mức bảo mật cao nhất: xác thực (SHA) + mã hóa payload (AES128)
            targetV3.setSecurityLevel(SecurityLevel.AUTH_PRIV);
            targetV3.setSecurityName(new OctetString(V3_USER)); // Ánh xạ đến user đã đăng ký trong USM

            long startV3 = System.currentTimeMillis();

            // ScopedPDU: có thêm contextEngineID và contextName cho v3
            ScopedPDU pduV3 = new ScopedPDU();
            pduV3.setType(PDU.GETBULK);
            pduV3.setMaxRepetitions(50);
            pduV3.setNonRepeaters(0);
            pduV3.add(new VariableBinding(new OID(START_OID)));

            // Quá trình gửi v3 tốn thêm thời gian vì: xác thực header SHA + mã hóa AES payload
            int v3OidsRetrieved = 0;
            ResponseEvent responseV3 = snmp.send(pduV3, targetV3);
            if (responseV3 != null && responseV3.getResponse() != null) {
                v3OidsRetrieved = responseV3.getResponse().getVariableBindings().size(); // Đếm số OID thực nhận
            }

            // Tính toán thời gian và throughput cho SNMPv3
            long timeV3 = System.currentTimeMillis() - startV3;
            long throughputV3 = timeV3 > 0 ? (v3OidsRetrieved * 1000L) / timeV3 : 0;

            // Đóng SNMP session
            snmp.close();

            // Tạo response cho từng protocol
            Map<String, Object> resV1 = new HashMap<>();
            resV1.put("protocol", "SNMPv1");
            resV1.put("timeMs", timeV1);
            resV1.put("requests", v1Requests);
            resV1.put("oidsRetrieved", v1OidsRetrieved);
            resV1.put("oidThroughput", throughputV1);
            resV1.put("pduType", "GETNEXT ×50");
            resV1.put("securityLevel", "None (Community)");
            results.add(resV1);

            Map<String, Object> resV2c = new HashMap<>();
            resV2c.put("protocol", "SNMPv2c");
            resV2c.put("timeMs", timeV2c);
            resV2c.put("requests", 1);
            resV2c.put("oidsRetrieved", v2cOidsRetrieved);
            resV2c.put("oidThroughput", throughputV2c);
            resV2c.put("pduType", "GETBULK ×1");
            resV2c.put("securityLevel", "Community-Based");
            results.add(resV2c);

            Map<String, Object> resV3 = new HashMap<>();
            resV3.put("protocol", "SNMPv3");
            resV3.put("timeMs", timeV3);
            resV3.put("requests", 1);
            resV3.put("oidsRetrieved", v3OidsRetrieved);
            resV3.put("oidThroughput", throughputV3);
            resV3.put("pduType", "GETBULK ×1");
            resV3.put("securityLevel", "Auth+Priv (SHA/AES128)");
            results.add(resV3);

            return ResponseEntity.ok(results);
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(500).body(null);
        }
    }

    // Cung cấp API trích xuất gói tin thô (byte payload) để Demo hệ thống bảo mật SNMP
    @GetMapping("/security-demo")
    public ResponseEntity<?> runSecurityDemo(@RequestParam("ip") String targetIp) {
        if (!"10.0.1.2".equals(targetIp)) {
            return ResponseEntity.status(403).body("Warning: Feature 'Packet Sniffing' for SNMPv3 is not configured on Agent " + targetIp + ". Please select Agent 10.0.1.2.");
        }

        Map<String, Map<String, String>> result = new HashMap<>();
        
        try {
            List<byte[]> interceptedPackets = new ArrayList<>();
            TransportMapping<? extends Address> transport = new DefaultUdpTransportMapping();
            
            // Tự động chặn đường truyền để chụp toàn bộ gói tin đi thẳng từ card mạng (mô phỏng Wireshark)
            transport.addTransportListener(new TransportListener() {
                @Override
                public void processMessage(TransportMapping source, Address incomingAddress, ByteBuffer buf, TransportStateReference tmStateReference) {
                    byte[] bytes = new byte[buf.remaining()];
                    buf.mark();
                    buf.get(bytes);
                    buf.reset(); // reset pointer để hệ thống SNMP4J vẫn đọc được gói tin phía sau
                    interceptedPackets.add(bytes);
                }
            });
            
            Snmp snmp = new Snmp(transport);
            USM usm = new USM(SecurityProtocols.getInstance(), new OctetString(MPv3.createLocalEngineID()), 0);
            SecurityModels.getInstance().addSecurityModel(usm);
            snmp.getUSM().addUser(new OctetString(V3_USER),
                    new UsmUser(new OctetString(V3_USER),
                            AuthSHA.ID, new OctetString(V3_AUTH_PASS),
                            PrivAES128.ID, new OctetString(V3_PRIV_PASS)));
            
            transport.listen();
            Address targetAddress = GenericAddress.parse("udp:" + targetIp + "/161");
            
            // Yêu cầu OID hệ điều hành, đây là chuỗi string nên dễ quan sát bằng mắt thường
            OID sysDescrOid = new OID("1.3.6.1.2.1.1.1.0"); 

            // ----- SNMPv1 -----
            interceptedPackets.clear();
            CommunityTarget<Address> targetV1 = new CommunityTarget<>();
            targetV1.setCommunity(new OctetString(COMMUNITY));
            targetV1.setAddress(targetAddress);
            targetV1.setRetries(1);
            targetV1.setTimeout(1500);
            targetV1.setVersion(SnmpConstants.version1);

            PDU pduV1 = new PDU();
            pduV1.add(new VariableBinding(sysDescrOid));
            pduV1.setType(PDU.GET);
            snmp.send(pduV1, targetV1);
            byte[] packV1 = interceptedPackets.isEmpty() ? new byte[0] : interceptedPackets.get(interceptedPackets.size() - 1);
            
            // ----- SNMPv2c -----
            interceptedPackets.clear();
            CommunityTarget<Address> targetV2c = new CommunityTarget<>();
            targetV2c.setCommunity(new OctetString(COMMUNITY));
            targetV2c.setAddress(targetAddress);
            targetV2c.setRetries(1);
            targetV2c.setTimeout(1500);
            targetV2c.setVersion(SnmpConstants.version2c);

            PDU pduV2c = new PDU();
            pduV2c.add(new VariableBinding(sysDescrOid));
            pduV2c.setType(PDU.GET);
            snmp.send(pduV2c, targetV2c);
            byte[] packV2 = interceptedPackets.isEmpty() ? new byte[0] : interceptedPackets.get(interceptedPackets.size() - 1);

            // ----- SNMPv3 -----
            interceptedPackets.clear();
            UserTarget<Address> targetV3 = new UserTarget<>();
            targetV3.setAddress(targetAddress);
            targetV3.setRetries(1);
            targetV3.setTimeout(1500);
            targetV3.setVersion(SnmpConstants.version3);
            targetV3.setSecurityLevel(SecurityLevel.AUTH_PRIV);
            targetV3.setSecurityName(new OctetString(V3_USER));

            ScopedPDU pduV3 = new ScopedPDU();
            pduV3.add(new VariableBinding(sysDescrOid));
            pduV3.setType(PDU.GET);
            snmp.send(pduV3, targetV3);
            byte[] packV3 = interceptedPackets.isEmpty() ? new byte[0] : interceptedPackets.get(interceptedPackets.size() - 1);

            snmp.close();

            Map<String, String> v1Data = new HashMap<>();
            v1Data.put("hex", toHex(packV1));
            v1Data.put("ascii", toAscii(packV1));
            result.put("v1", v1Data);

            Map<String, String> v2cData = new HashMap<>();
            v2cData.put("hex", toHex(packV2));
            v2cData.put("ascii", toAscii(packV2));
            result.put("v2c", v2cData);

            Map<String, String> v3Data = new HashMap<>();
            v3Data.put("hex", toHex(packV3));
            v3Data.put("ascii", toAscii(packV3));
            result.put("v3", v3Data);

            return ResponseEntity.ok(result);
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(500).body(null);
        }
    }

    private String toHex(byte[] bytes) {
        StringBuilder sb = new StringBuilder();
        for (byte b : bytes) {
            sb.append(String.format("%02X ", b));
        }
        return sb.toString().trim();
    }

    private String toAscii(byte[] bytes) {
        StringBuilder sb = new StringBuilder();
        for (byte b : bytes) {
            if (b >= 32 && b <= 126) sb.append((char) b);
            else sb.append('.');
        }
        return sb.toString();
    }
}
