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
public class ProtocolTesterController {

    private static final String COMMUNITY = "public";
    private static final String START_OID = "1.3.6.1.2.1.2.2.1.10";

    private static final String V3_USER = "adminv3";
    private static final String V3_AUTH_PASS = "admin12345";
    private static final String V3_PRIV_PASS = "admin12345";

    // Thực thi giả lập bài test gửi 50 gói tin liên tục để đo đạc và so sánh tốc độ
    // sinh thái của 3 chuẩn SNMP (v1, v2c, v3).
    @GetMapping("/run")
    public ResponseEntity<List<Map<String, Object>>> runBenchmark(@RequestParam("ip") String targetIp) {
        List<Map<String, Object>> results = new ArrayList<>();

        try {
            TransportMapping<? extends Address> transport = new DefaultUdpTransportMapping();
            Snmp snmp = new Snmp(transport);

            USM usm = new USM(SecurityProtocols.getInstance(), new OctetString(MPv3.createLocalEngineID()), 0);
            SecurityModels.getInstance().addSecurityModel(usm);
            snmp.getUSM().addUser(new OctetString(V3_USER),
                    new UsmUser(new OctetString(V3_USER),
                            AuthSHA.ID, new OctetString(V3_AUTH_PASS),
                            PrivAES128.ID, new OctetString(V3_PRIV_PASS)));

            transport.listen();
            Address targetAddress = GenericAddress.parse("udp:" + targetIp + "/161");

            CommunityTarget targetV1 = new CommunityTarget();
            targetV1.setCommunity(new OctetString(COMMUNITY));
            targetV1.setAddress(targetAddress);
            targetV1.setRetries(1);
            targetV1.setTimeout(1500);
            targetV1.setVersion(SnmpConstants.version1);

            long startV1 = System.currentTimeMillis();
            OID currentOid = new OID(START_OID);
            int v1Requests = 0;

            for (int i = 0; i < 50; i++) {
                PDU pduV1 = new PDU();
                pduV1.add(new VariableBinding(currentOid));
                pduV1.setType(PDU.GETNEXT);
                ResponseEvent responseV1 = snmp.send(pduV1, targetV1);
                v1Requests++;
                if (responseV1 != null && responseV1.getResponse() != null) {
                    currentOid = responseV1.getResponse().get(0).getOid();
                }
            }
            long timeV1 = System.currentTimeMillis() - startV1;

            CommunityTarget targetV2c = new CommunityTarget();
            targetV2c.setCommunity(new OctetString(COMMUNITY));
            targetV2c.setAddress(targetAddress);
            targetV2c.setRetries(1);
            targetV2c.setTimeout(1500);
            targetV2c.setVersion(SnmpConstants.version2c);

            long startV2c = System.currentTimeMillis();
            PDU pduV2c = new PDU();
            pduV2c.setType(PDU.GETBULK);
            pduV2c.setMaxRepetitions(50);
            pduV2c.setNonRepeaters(0);
            pduV2c.add(new VariableBinding(new OID(START_OID)));

            snmp.send(pduV2c, targetV2c);
            long timeV2c = System.currentTimeMillis() - startV2c;

            UserTarget targetV3 = new UserTarget();
            targetV3.setAddress(targetAddress);
            targetV3.setRetries(1);
            targetV3.setTimeout(1500);
            targetV3.setVersion(SnmpConstants.version3);
            targetV3.setSecurityLevel(SecurityLevel.AUTH_PRIV);
            targetV3.setSecurityName(new OctetString(V3_USER));

            long startV3 = System.currentTimeMillis();
            ScopedPDU pduV3 = new ScopedPDU();
            pduV3.setType(PDU.GETBULK);
            pduV3.setMaxRepetitions(50);
            pduV3.setNonRepeaters(0);
            pduV3.add(new VariableBinding(new OID(START_OID)));

            snmp.send(pduV3, targetV3);
            long timeV3 = System.currentTimeMillis() - startV3;

            snmp.close();

            Map<String, Object> resV1 = new HashMap<>();
            resV1.put("protocol", "SNMPv1");
            resV1.put("timeMs", timeV1);
            resV1.put("requests", v1Requests);
            results.add(resV1);

            Map<String, Object> resV2c = new HashMap<>();
            resV2c.put("protocol", "SNMPv2c");
            resV2c.put("timeMs", timeV2c);
            resV2c.put("requests", 1);
            results.add(resV2c);

            Map<String, Object> resV3 = new HashMap<>();
            resV3.put("protocol", "SNMPv3");
            resV3.put("timeMs", timeV3);
            resV3.put("requests", 1);
            results.add(resV3);

            return ResponseEntity.ok(results);
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.status(500).body(null);
        }
    }
}
