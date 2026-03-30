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

    @GetMapping("/metrics")
    public ResponseEntity<Map<String, Object>> getMetrics() {
        return ResponseEntity.ok(pollerService.getLatestMetrics());
    }

    @GetMapping("/alerts")
    public ResponseEntity<List<Map<String, String>>> getAlerts() {
        return ResponseEntity.ok(trapService.getAlertHistory());
    }

    // API kích hoạt Iptables THỦ CÔNG 
    @PostMapping("/config/protect")
    public ResponseEntity<String> activateShield(@RequestParam String targetIp) {
        // Cần gọi đúng hàm triggerManualMitigation bên TrapService
        boolean success = trapService.triggerManualMitigation(targetIp); 
        
        if (success) {
            return ResponseEntity.ok("Manual shield activated and auto-task cancelled on " + targetIp);
        } else {
            return ResponseEntity.status(500).body("Failed to activate manual shield!");
        }
    }

    @GetMapping("/logs")
    public ResponseEntity<List<Map<String, Object>>> getEvaluationLogs() {
        return ResponseEntity.ok(trapService.getEvaluationLogs());
    }

    @PostMapping("/config/delay")
    public ResponseEntity<String> updateDelayConfig(@RequestParam int delay) {
        trapService.setMitigationDelay(delay);
        return ResponseEntity.ok("Delay updated to " + delay + " seconds");
    }
}
