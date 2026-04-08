// ProtocolPerformanceController.java: Controller để benchmark hiệu suất của SNMPv1, SNMPv2c và SNMPv3 trên Agent
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

@RestController
@RequestMapping("/api/benchmark")
@CrossOrigin(origins = "*")
public class ProtocolPerformanceController {
    // Cấu hình xác thực SNMPv3 (phải khớp với cấu hình trên Agent)
    private static final String V3_USER = "adminv3";
    private static final String V3_AUTH_PASS = "admin12345";
    private static final String V3_PRIV_PASS = "admin12345";

    // Community string dùng cho SNMPv1/v2c (read-only)
    private static final String COMMUNITY = "public";
    
    // OID gốc để bắt đầu bài test: ifInOctets (số byte nhận được trên interface)
    private static final String START_OID = "1.3.6.1.2.1.2.2.1.10";

    // Thực thi giả lập bài test gửi 50 gói tin liên tục để đo đạc và so sánh tốc độ
    @GetMapping("/run")
    public ResponseEntity<?> runBenchmark(@RequestParam("ip") String targetIp) {
        // Chỉ hỗ trợ benchmark trên Agent VM1 (IP: 10.0.1.2)
        if (!"10.0.1.2".equals(targetIp)) {
            return ResponseEntity.status(403).body("Warning: Feature 'SNMPv3 Benchmark' is not configured on Agent "
                    + targetIp + ". Please select Agent 10.0.1.2.");
        }

        List<Map<String, Object>> results = new ArrayList<>();
        Snmp snmp = null;

        try {
            // Tạo kênh truyền UDP (không gắn port cụ thể, dùng cổng ngẫu nhiên phía client)
            TransportMapping<? extends Address> transport = new DefaultUdpTransportMapping();
            snmp = new Snmp(transport);

            // Khởi tạo USM (User Security Model) để hỗ trợ SNMPv3
            USM usm = new USM(SecurityProtocols.getInstance(), new OctetString(MPv3.createLocalEngineID()), 0);
            SecurityModels.getInstance().addSecurityModel(usm);
            
            // Đăng ký user SNMPv3 với giao thức Auth=SHA, Privacy=AES128
            snmp.getUSM().addUser(new OctetString(V3_USER),
                    new UsmUser(new OctetString(V3_USER),
                            AuthSHA.ID, new OctetString(V3_AUTH_PASS),
                            PrivAES128.ID, new OctetString(V3_PRIV_PASS)));

            // Bắt đầu lắng nghe trên kênh truyền để có thể nhận phản hồi từ Agent
            transport.listen();
            
            // Định nghĩa địa chỉ đích (Agent) cho cả 3 phiên bản SNMP
            Address targetAddress = GenericAddress.parse("udp:" + targetIp + "/161");

            // SNMPv1: Sử dụng PDU GETNEXT để liên tục truy vấn OID tiếp theo, tổng cộng 50 lần
            CommunityTarget<Address> targetV1 = new CommunityTarget<>();
            targetV1.setCommunity(new OctetString(COMMUNITY)); // Sử dụng community string "public" đã cấu hình trên Agent
            targetV1.setAddress(targetAddress);
            targetV1.setRetries(1);
            targetV1.setTimeout(1500);
            targetV1.setVersion(SnmpConstants.version1);

            long startV1 = System.currentTimeMillis(); // Bat đầu đo thời gian
            OID currentOid = new OID(START_OID);
            int v1Requests = 0; // Đếm số lần gửi request SNMPv1
            int v1OidsRetrieved = 0; // Đếm số OID đã lấy được từ SNMPv1

            // Thực hiện 50 lần GETNEXT liên tiếp để đo hiệu suất SNMPv1
            for (int i = 0; i < 50; i++) {
                PDU pduV1 = new PDU();
                pduV1.add(new VariableBinding(currentOid));
                pduV1.setType(PDU.GETNEXT); // Sử dụng GETNEXT để lấy OID tiếp theo trong MIB tree
                
                // Gửi PDU và nhận phản hồi từ Agent
                ResponseEvent responseV1 = snmp.send(pduV1, targetV1);
                v1Requests++;

                // Kiểm tra phản hồi có hợp lệ không và cập nhật OID tiếp theo để truy vấn
                if (responseV1 != null && responseV1.getResponse() != null) {
                    v1OidsRetrieved += responseV1.getResponse().getVariableBindings().size();
                    currentOid = responseV1.getResponse().get(0).getOid();
                }
            }

            // Kết thúc đo thời gian và tính toán throughput cho SNMPv1
            long timeV1 = System.currentTimeMillis() - startV1;
            long throughputV1 = timeV1 > 0 ? (v1OidsRetrieved * 1000L) / timeV1 : 0;

            // SNMPv2c: Sử dụng PDU GETBULK để lấy 50 OID tiếp theo chỉ trong 1 request duy nhất
            CommunityTarget<Address> targetV2c = new CommunityTarget<>();
            targetV2c.setCommunity(new OctetString(COMMUNITY));
            targetV2c.setAddress(targetAddress);
            targetV2c.setRetries(1);
            targetV2c.setTimeout(1500);
            targetV2c.setVersion(SnmpConstants.version2c); // Sử dụng SNMPv2c

            long startV2c = System.currentTimeMillis();
            PDU pduV2c = new PDU();
            pduV2c.setType(PDU.GETBULK); // Sử dụng GETBULK để lấy nhiều OID trong 1 request
            pduV2c.setMaxRepetitions(50); // Yêu cầu lấy tối đa 50 OID tiếp theo
            pduV2c.setNonRepeaters(0); // Không có OID đặc biệt nào cần lấy 1 lần
            pduV2c.add(new VariableBinding(new OID(START_OID)));
            
            // Gửi PDU và nhận phản hồi từ Agent, đếm số OID đã lấy được
            int v2cOidsRetrieved = 0;
            ResponseEvent responseV2c = snmp.send(pduV2c, targetV2c);
            if (responseV2c != null && responseV2c.getResponse() != null) {
                v2cOidsRetrieved = responseV2c.getResponse().getVariableBindings().size();
            }
            
            // Kết thúc đo thời gian và tính toán throughput cho SNMPv2c
            long timeV2c = System.currentTimeMillis() - startV2c;
            long throughputV2c = timeV2c > 0 ? (v2cOidsRetrieved * 1000L) / timeV2c : 0;

            // SNMPv3: Sử dụng PDU GETBULK tương tự SNMPv2c nhưng với xác thực và mã hóa để đo hiệu suất của SNMPv3
            UserTarget<Address> targetV3 = new UserTarget<>();
            targetV3.setAddress(targetAddress);
            targetV3.setRetries(1);
            targetV3.setTimeout(1500);
            targetV3.setVersion(SnmpConstants.version3); // Sử dụng SNMPv3
            
            // Sử dụng mức bảo mật cao nhất: xác thực (SHA) + mã hóa payload (AES128)
            targetV3.setSecurityLevel(SecurityLevel.AUTH_PRIV);
            targetV3.setSecurityName(new OctetString(V3_USER)); // Ánh xạ đến user đã đăng ký trong USM

            long startV3 = System.currentTimeMillis();
            
            // Khởi tạo ScopedPDU: có thêm contextEngineId và contextName (để tương thích với SNMPv3)
            ScopedPDU pduV3 = new ScopedPDU();
            pduV3.setType(PDU.GETBULK);
            pduV3.setMaxRepetitions(50);
            pduV3.setNonRepeaters(0);
            pduV3.add(new VariableBinding(new OID(START_OID)));

            // Quá trình gửi v3 sẽ tốn thêm thời gian vì xác thực header SHA + mã hóa AES payload
            int v3OidsRetrieved = 0;
            ResponseEvent responseV3 = snmp.send(pduV3, targetV3);
            if (responseV3 != null && responseV3.getResponse() != null) {
                v3OidsRetrieved = responseV3.getResponse().getVariableBindings().size();
            }

            // Kết thúc đo thời gian và tính toán throughput cho SNMPv3
            long timeV3 = System.currentTimeMillis() - startV3;
            long throughputV3 = timeV3 > 0 ? (v3OidsRetrieved * 1000L) / timeV3 : 0;

            // Build Results
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
        } finally {
            // Đảm bảo luôn đóng kết nối SNMP dù có lỗi xảy ra
            if (snmp != null) {
                try {
                    snmp.close();
                } catch (Exception ex) {
                    ex.printStackTrace();
                }
            }
        }
    }
}