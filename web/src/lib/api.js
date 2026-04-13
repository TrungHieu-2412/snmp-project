// api.js: API kết nối với Backend
const API_BASE_URL = import.meta.env.VITE_API_BASE || 'http://localhost:8080/api';

export const dashboardAPI = {
  // Lấy chỉ số CPU, RAM, Băng thông, PPS mới nhất của máy Agent
  getMetrics: async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/metrics`);
      if (!response.ok) throw new Error('Error fetching metrics');
      return await response.json();
    } catch (error) {
      console.error("API getMetrics error:", error);
      return null;
    }
  },

  // Gọi API lấy danh sách cảnh báo (gồm cả thời gian nhận TRAP và trạng thái kích hoạt khiên iptables)
  getAlerts: async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/alerts`);
      if (!response.ok) throw new Error('Error fetching alerts');
      return await response.json();
    } catch (error) {
      console.error("API getAlerts error:", error);
      return [];
    }
  },

  // Chạy bài test mô phỏng Wireshark để trích xuất payload raw từ giao thức SNMP
  runSecurityDemo: async (ip) => {
    try {
      const response = await fetch(`${API_BASE_URL}/benchmark/security-demo?ip=${ip}`);
      if (!response.ok) {
        const errText = await response.text();
        return { error: errText };
      }
      return await response.json();
    } catch (error) {
      console.error("API runSecurityDemo error:", error);
      return { error: "Network error or failure during packet capture." };
    }
  },

  // Gửi lệnh thủ công để kích hoạt bảo vệ Iptables (thông qua lệnh SNMP SET)
  mitigateAttack: async (targetIp, typeId = 1) => {
    try {
      const response = await fetch(`${API_BASE_URL}/config/protect?targetIp=${targetIp}&typeId=${typeId}`, {
        method: 'POST',
      });
      if (!response.ok) throw new Error('Error sending mitigate command');
      return await response.text();
    } catch (error) {
      console.error("API mitigateAttack error:", error);
      return null;
    }
  },

  // Gửi cập nhật thông số thời gian trễ (delay) cho hệ thống Auto-IPS của backend
  updateDelayConfig: async (delaySeconds) => {
    try {
      const response = await fetch(`${API_BASE_URL}/config/delay?delay=${delaySeconds}`, {
        method: 'POST',
      });
      return response.ok;
    } catch (error) {
      console.error("API updateDelayConfig error:", error);
      return false;
    }
  },

  // Đồng bộ trạng thái Bật/Tắt Auto-IPS xuống Backend
  updateAutoModeConfig: async (enabled) => {
    try {
      const response = await fetch(`${API_BASE_URL}/config/auto-mode?enabled=${enabled}`, {
        method: 'POST',
      });
      return response.ok;
    } catch (error) {
      console.error("API updateAutoModeConfig error:", error);
      return false;
    }
  },

  // Lấy toàn bộ lịch sử file log (Nhật ký đánh giá hiệu năng) xuất ra cho bảng EvaluationLogs
  getEvaluationLogs: async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/logs`);
      if (!response.ok) throw new Error('Error fetching evaluation logs');
      return await response.json();
    } catch (error) {
      console.error("API getEvaluationLogs error:", error);
      return [];
    }
  },

  // Thêm IP của Agent mới vào hệ thống backend để theo dõi
  addNewDevice: async (ip) => {
    try {
      const response = await fetch(`${API_BASE_URL}/device/add?ip=${ip}`, {
        method: 'POST',
      });
      return response.ok;
    } catch (error) {
      console.error("API addNewDevice error:", error);
      return false;
    }
  },

  // Chạy bài Benchmark so sánh hiệu năng SNMPv1, v2c, v3 trên Agent
  runProtocolBenchmark: async (ip) => {
    try {
      const response = await fetch(`${API_BASE_URL}/benchmark/run?ip=${ip}`);
      if (!response.ok) {
        const errText = await response.text();
        return { error: errText };
      }
      return await response.json();
    } catch (error) {
      console.error("API runProtocolBenchmark error:", error);
      return { error: "Network error or failure during benchmark." };
    }
  },

  // Kiểm tra xem IP Agent có hỗ trợ tính năng IPS (TRAP & SET) không
  checkIpsSupport: async (ip) => {
    try {
      const response = await fetch(`${API_BASE_URL}/features/ips-support?ip=${ip}`);
      if (!response.ok) throw new Error('Error checking IPS support');
      return await response.json();
    } catch (error) {
      console.error("API checkIpsSupport error:", error);
      return false;
    }
  },

  // Lấy chỉ số mạng của tất cả Agent (inPps, outPps, downKbps, upKbps) để vẽ sơ đồ Topology
  getTopologyMetrics: async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/metrics`);
      if (!response.ok) throw new Error('Error fetching topology metrics');
      return await response.json();
    } catch (error) {
      console.error("API getTopologyMetrics error:", error);
      return null;
    }
  },
};