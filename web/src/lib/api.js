// src/lib/api.js
const API_BASE_URL = import.meta.env.VITE_API_BASE || 'http://34.2.153.29:8080/api';

export const dashboardAPI = {
  // 1. Lấy chỉ số CPU, RAM, Băng thông mới nhất
  getMetrics: async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/metrics`);
      if (!response.ok) throw new Error('Lỗi khi fetch metrics');
      return await response.json();
    } catch (error) {
      console.error("API getMetrics error:", error);
      return null; // Trả về null nếu BE sập
    }
  },

  // 2. Lấy danh sách lịch sử cảnh báo TRAP
  getAlerts: async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/alerts`);
      if (!response.ok) throw new Error('Lỗi khi fetch alerts');
      return await response.json();
    } catch (error) {
      console.error("API getAlerts error:", error);
      return [];
    }
  },

  // 3. Gửi lệnh kích hoạt Iptables thủ công
  mitigateAttack: async (targetIp) => {
    try {
      const response = await fetch(`${API_BASE_URL}/config/protect?targetIp=${targetIp}`, {
        method: 'POST',
      });
      if (!response.ok) throw new Error('Lỗi khi gửi lệnh mitigate');
      return await response.text();
    } catch (error) {
      console.error("API mitigateAttack error:", error);
      return null;
    }
  },
  // 4. Cập nhật thời gian trễ Auto-IPS
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

  // 5. Lấy dữ liệu cho bảng Evaluation Logs
  getEvaluationLogs: async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/logs`);
      if (!response.ok) throw new Error('Lỗi khi fetch evaluation logs');
      return await response.json();
    } catch (error) {
      console.error("API getEvaluationLogs error:", error);
      return [];
    }
  }
};