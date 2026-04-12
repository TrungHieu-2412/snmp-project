// ProtocolSecurityController.java: Controller này sẽ demo tính bảo mật của SNMPv3 so với SNMPv1, SNMPv2c trên Agent
package org.example;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.snmp4j.CommunityTarget;
import org.snmp4j.PDU;
import org.snmp4j.ScopedPDU;
import org.snmp4j.Snmp;
import org.snmp4j.TransportMapping;
import org.snmp4j.UserTarget;
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

import java.nio.ByteBuffer;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CopyOnWriteArrayList;

@RestController
@RequestMapping("/api/benchmark")
@CrossOrigin(origins = "*")
public class ProtocolSecurityController {
    private static final Logger logger = LoggerFactory.getLogger(ProtocolSecurityController.class);

    private static final String V3_USER = "adminv3";
    private static final String V3_AUTH_PASS = "admin12345";
    private static final String V3_PRIV_PASS = "admin12345";
    private static final String COMMUNITY = "public";

    // OID chuẩn để lấy thông tin mô tả hệ thống (sysDescr)
    private static final String OID_SYS_DESCR = "1.3.6.1.2.1.1.1.0";

    // Endpoint thực hiện một bài demo để minh họa sự khác biệt về bảo mật giữa SNMPv1/v2c (không mã hóa) và SNMPv3 (có mã hóa)
    @GetMapping("/security-demo")
    public ResponseEntity<?> runSecurityDemo(@RequestParam("ip") String targetIp) {
        if (!"10.0.1.2".equals(targetIp)) {
            logger.warn("⚠️ FORBIDDEN: Security Demo requested for unauthorized IP: {}", targetIp);
            return ResponseEntity.status(403)
                    .body("Warning: Feature 'Packet Sniffing' for SNMPv3 is not configured on Agent " + targetIp
                            + ". Please select Agent 10.0.1.2.");
        }

        logger.info("🛡️ Starting Security Packet Sniffing Demo for IP: {}", targetIp);
        Map<String, Map<String, String>> result = new HashMap<>();
        Snmp snmp = null;

        try {
            // Thiết lập một TransportMapping để lắng nghe tất cả các gói SNMP gửi đi từ client đến Agent
            List<byte[]> interceptedPackets = new CopyOnWriteArrayList<>();
            TransportMapping<? extends Address> transport = new DefaultUdpTransportMapping();

            // Thêm một TransportListener để chặn và lưu lại tất cả các gói SNMP được gửi đi
            transport.addTransportListener(new TransportListener() {
                @Override
                public void processMessage(TransportMapping source, Address incomingAddress, ByteBuffer buf,
                        TransportStateReference tmStateReference) {
                    byte[] bytes = new byte[buf.remaining()];
                    buf.mark();
                    buf.get(bytes);
                    buf.reset();
                    interceptedPackets.add(bytes);
                }
            });

            // Khởi tạo Snmp instance với USM để hỗ trợ SNMPv3, đồng thời đăng ký một user có xác thực và mã hóa
            snmp = new Snmp(transport);
            USM usm = new USM(SecurityProtocols.getInstance(), new OctetString(MPv3.createLocalEngineID()), 0);
            SecurityModels.getInstance().addSecurityModel(usm);
            snmp.getUSM().addUser(new OctetString(V3_USER),
                    new UsmUser(new OctetString(V3_USER),
                            AuthSHA.ID, new OctetString(V3_AUTH_PASS),
                            PrivAES128.ID, new OctetString(V3_PRIV_PASS)));

            transport.listen();
            Address targetAddress = GenericAddress.parse("udp:" + targetIp + "/161");

            // Sử dụng OID lấy thông tin mô tả hệ thống (sysDescr) để demo
            OID sysDescrOid = new OID(OID_SYS_DESCR);

            // SNMPv1: Gửi một PDU GET đơn giản và chặn gói tin để xem nội dung không mã hóa
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

            // Lấy gói tin cuối cùng được chặn (tương ứng với request SNMPv1) để phân tích
            byte[] packV1 = interceptedPackets.isEmpty() ? new byte[0]
                    : interceptedPackets.get(interceptedPackets.size() - 1);

            // SNMPv2c: Tương tự SNMPv1, vẫn không mã hóa nên gói tin sẽ hiển thị rõ ràng thông tin OID và community string
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
            byte[] packV2 = interceptedPackets.isEmpty() ? new byte[0]
                    : interceptedPackets.get(interceptedPackets.size() - 1);

            // SNMPv3: Gói tin sẽ được mã hóa hoàn toàn, khi chặn gói tin sẽ thấy dữ liệu đã bị mã hóa thông tin OID và community string
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
            byte[] packV3 = interceptedPackets.isEmpty() ? new byte[0]
                    : interceptedPackets.get(interceptedPackets.size() - 1);

            // Build kết quả trả về cho client, bao gồm cả dạng hex và ascii của gói tin
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

            logger.info("✅ Security Demo Finished. Intercepted packets: v1={}, v2c={}, v3={}", packV1.length,
                    packV2.length, packV3.length);
            return ResponseEntity.ok(result);

        } catch (Exception e) {
            logger.error("❌ Error during Security Demo Sniffing: ", e);
            return ResponseEntity.status(500).body(null);
        } finally {
            // Đảm bảo giải phóng port UDP ngay cả khi lỗi
            if (snmp != null) {
                try {
                    snmp.close();
                } catch (Exception ex) {
                    ex.printStackTrace();
                }
            }
        }
    }

    // Hàm tiện ích để chuyển byte array thành chuỗi hex
    private String toHex(byte[] bytes) {
        StringBuilder sb = new StringBuilder();
        for (byte b : bytes) {
            sb.append(String.format("%02X ", b));
        }
        return sb.toString().trim();
    }

    // Hàm tiện ích để chuyển byte array thành chuỗi ASCII
    private String toAscii(byte[] bytes) {
        StringBuilder sb = new StringBuilder();
        for (byte b : bytes) {
            if (b >= 32 && b <= 126)
                sb.append((char) b);
            else
                sb.append('.');
        }
        return sb.toString();
    }
}