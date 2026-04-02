package org.example;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api")
@CrossOrigin(origins = "*")
public class DashboardController {

    @Autowired
    private SnmpPollerService pollerService;

    @Autowired
    private TrapReceiverService trapService;

    // 1. API lấy số liệu CPU, RAM, Băng thông, PPS của máy Agent
    @GetMapping("/metrics")
    public ResponseEntity<Map<String, Map<String, Object>>> getAllMetrics() {
        return ResponseEntity.ok(pollerService.getAllMetrics());
    }

    // API thêm thiết bị mới
    @PostMapping("/device/add")
    public ResponseEntity<String> addNewDevice(@RequestParam String ip) {
        pollerService.addDevice(ip);
        return ResponseEntity.ok("The IP address " + ip + " has been added to the monitoring system!");
    }

    // 2. API lấy danh sách cảnh báo
    @GetMapping("/alerts")
    public ResponseEntity<List<Map<String, String>>> getAlerts() {
        return ResponseEntity.ok(trapService.getAlertHistory());
    }

    // 3. API kích hoạt Iptables để đánh chặn thủ công
    @PostMapping("/config/protect")
    public ResponseEntity<String> activateShield(@RequestParam String targetIp) {
        boolean success = trapService.triggerMitigationSet(targetIp);
        if (success) {
            return ResponseEntity.ok("Shield activated successfully on " + targetIp);
        } else {
            return ResponseEntity.status(500).body("Failed to activate shield!");
        }
    }

    @PostMapping("/config/delay")
    public ResponseEntity<String> updateDelay(@RequestParam int delay) {
        trapService.setMitigationDelay(delay);
        return ResponseEntity.ok("Updated delay to " + delay + " seconds");
    }

    // 4. API lấy log của hệ thống Agent
    @GetMapping("/logs")
    public ResponseEntity<List<Map<String, Object>>> getEvaluationLogs() {
        return ResponseEntity.ok(trapService.getEvaluationLogs());
    }

}