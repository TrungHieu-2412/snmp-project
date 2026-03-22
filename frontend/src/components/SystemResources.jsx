import React from 'react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';

// --- Dữ liệu giả lập 1: Tải CPU và RAM (%) ---
const mockResourceData = [
  { time: '10:00:00', cpu: 15, ram: 45 },
  { time: '10:00:05', cpu: 18, ram: 46 },
  { time: '10:00:10', cpu: 16, ram: 46 },
  // Bị tấn công -> Quá tải Kernel
  { time: '10:00:15', cpu: 85, ram: 80 }, 
  { time: '10:00:20', cpu: 98, ram: 95 }, 
  // Phục hồi
  { time: '10:00:25', cpu: 45, ram: 60 },
  { time: '10:00:30', cpu: 20, ram: 48 },
];

// --- Dữ liệu giả lập 2: Số lượng kết nối TCP ---
const currentTcpConnections = 145; // Vượt ngưỡng 100 -> Đang bị SYN Flood
const maxTcpScale = 200; // Thang đo tối đa của đồng hồ

// Tính toán phần trăm cho đồng hồ đo
const gaugeData = [
  { name: 'Kết nối hiện tại', value: currentTcpConnections },
  { name: 'Trống', value: Math.max(0, maxTcpScale - currentTcpConnections) }
];
// Màu sắc: Đỏ nếu vượt 100 (báo động), Xanh lá nếu an toàn
const gaugeColor = currentTcpConnections > 100 ? '#ef4444' : '#10b981'; 

const SystemResources = () => {
  return (
    <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
      <h2 style={{ fontSize: '18px', marginBottom: '20px', color: '#1f2937' }}>
        Giám sát Tài nguyên & Lỗ hổng (System Resources)
      </h2>
      
      {/* Biểu đồ 1: Tải CPU & RAM */}
      <div style={{ marginBottom: '30px' }}>
        <h3 style={{ fontSize: '14px', color: '#4b5563', marginBottom: '10px' }}>
          Mức tiêu thụ CPU & RAM (%)
        </h3>
        <div style={{ height: '200px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={mockResourceData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="time" />
              <YAxis domain={[0, 100]} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="cpu" stroke="#ef4444" name="Tải CPU (%)" strokeWidth={2} />
              <Line type="monotone" dataKey="ram" stroke="#8b5cf6" name="Tải RAM (%)" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Biểu đồ 2: Đồng hồ đo Kết nối TCP */}
      <div>
        <h3 style={{ fontSize: '14px', color: '#4b5563', marginBottom: '0px' }}>
          Đồng hồ kết nối TCP (Ngưỡng cảnh báo: 100)
        </h3>
        <div style={{ height: '180px', position: 'relative' }}>
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={gaugeData}
                cx="50%"
                cy="70%" /* Đẩy tâm xuống dưới để vẽ nửa vòng tròn */
                startAngle={180}
                endAngle={0}
                innerRadius={60}
                outerRadius={80}
                dataKey="value"
                stroke="none"
              >
                <Cell fill={gaugeColor} />
                <Cell fill="#e5e7eb" /> {/* Màu nền xám nhạt cho phần còn lại */}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
          
          {/* Con số hiển thị giữa đồng hồ */}
          <div style={{
            position: 'absolute',
            top: '60%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            textAlign: 'center'
          }}>
            <div style={{ fontSize: '32px', fontWeight: 'bold', color: gaugeColor }}>
              {currentTcpConnections}
            </div>
            <div style={{ fontSize: '12px', color: '#6b7280' }}>Kết nối đang mở</div>
          </div>
        </div>
      </div>
      
    </div>
  );
};

export default SystemResources;