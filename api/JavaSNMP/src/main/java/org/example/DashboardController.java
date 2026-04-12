// DashboardController.java: Endpoint API điều khiển chính của BE
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

    // Cung cấp API GET để Frontend theo dõi tức thời hiệu năng (CPU, RAM, Tốc độ
    // mạng) của các Agents.
    @GetMapping("/metrics")
    public ResponseEntity<Map<String, Map<String, Object>>> getAllMetrics() {
        return ResponseEntity.ok(pollerService.getAllMetrics());
    }

    // Cung cấp API POST cho phép Frontend thêm một Agent IP mới vào mạng lưới giám
    // sát.
    @PostMapping("/device/add")
    public ResponseEntity<String> addNewDevice(@RequestParam String ip) {
        pollerService.addDevice(ip);
        return ResponseEntity.ok("The IP address " + ip + " has been added to the monitoring system!");
    }

    // Cung cấp API GET để hiển thị các thông báo (TRAP Alert) nếu máy Agent đang bị
    // tấn công.
    @GetMapping("/alerts")
    public ResponseEntity<List<Map<String, String>>> getAlerts() {
        return ResponseEntity.ok(trapService.getAlertHistory());
    }

    // Cung cấp API POST điều khiển từ xa, ghi đè lệnh Iptables để chặn cuộc tấn
    // công trên Agent mục tiêu.
    @PostMapping("/config/protect")
    public ResponseEntity<String> activateShield(@RequestParam String targetIp) {
        boolean success = trapService.triggerMitigationSet(targetIp);
        if (success) {
            return ResponseEntity.ok("Shield activated successfully on " + targetIp);
        } else {
            return ResponseEntity.status(500).body("Failed to activate shield!");
        }
    }

    // Cung cấp API POST cập nhật thời gian trễ (để test hiệu năng chênh lệch khi bị
    // tấn công).
    @PostMapping("/config/delay")
    public ResponseEntity<String> updateDelay(@RequestParam int delay) {
        trapService.setMitigationDelay(delay);
        return ResponseEntity.ok("Updated delay to " + delay + " seconds");
    }

    // Cung cấp API POST cấu hình chế độ bảo vệ (Tự động hoặc Thủ công)
    @PostMapping("/config/auto-mode")
    public ResponseEntity<String> updateAutoMode(@RequestParam boolean enabled) {
        trapService.setAutoMode(enabled);
        return ResponseEntity.ok("Updated Auto-IPS mode to " + (enabled ? "ON" : "OFF"));
    }

    // Cung cấp API GET trích xuất Nhật ký Đánh giá chứa các số liệu sau quá trình
    // Anti-DDoS.
    @GetMapping("/logs")
    public ResponseEntity<List<Map<String, Object>>> getEvaluationLogs() {
        return ResponseEntity.ok(trapService.getEvaluationLogs());
    }

    // Cung cấp API GET để kiểm tra xem IP có hỗ trợ tính năng IPS (TRAP & SET)
    // không
    @GetMapping("/features/ips-support")
    public ResponseEntity<Boolean> checkIpsSupport(@RequestParam String ip) {
        boolean isSupported = "10.0.1.2".equals(ip);
        return ResponseEntity.ok(isSupported);
    }
    // API GET dữ liệu Topology trực tiếp từ bộ nhớ đệm (Cache) của PollerService
    // Dữ liệu sẽ được Component NetworkTopology.jsx trên ReactJS gọi mỗi 3 giây
    @GetMapping("/network/topology")
    public ResponseEntity<Map<String, Map<String, Object>>> getNetworkTopology() {
        return ResponseEntity.ok(pollerService.getAllMetrics());
    }
}