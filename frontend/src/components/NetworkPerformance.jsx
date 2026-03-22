import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const mockNetworkData = [
  { time: '10:00:00', bandwidth: 95, pps: 500 },
  { time: '10:00:05', bandwidth: 92, pps: 520 },
  { time: '10:00:10', bandwidth: 96, pps: 480 },
  // Bắt đầu bị tấn công UDP/ACK Flood
  { time: '10:00:15', bandwidth: 30, pps: 15000 }, 
  { time: '10:00:20', bandwidth: 5,  pps: 25000 }, 
  // Hệ thống kích hoạt iptables -> Phục hồi
  { time: '10:00:25', bandwidth: 70, pps: 800 },
  { time: '10:00:30', bandwidth: 90, pps: 510 },
];

const NetworkPerformance = () => {
  return (
    <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
      <h2 style={{ fontSize: '18px', marginBottom: '20px', color: '#1f2937' }}>
        Giám sát Hiệu năng Mạng (Network Performance)
      </h2>
      
      {/* Biểu đồ 1: Băng thông (Throughput) */}
      <div style={{ marginBottom: '30px' }}>
        <h3 style={{ fontSize: '14px', color: '#4b5563', marginBottom: '10px' }}>
          Băng thông hợp lệ - Throughput (Mbps)
        </h3>
        <div style={{ height: '200px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={mockNetworkData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="time" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="bandwidth" stroke="#3b82f6" name="Băng thông (Mbps)" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Biểu đồ 2: Tốc độ gói tin (PPS) */}
      <div>
        <h3 style={{ fontSize: '14px', color: '#4b5563', marginBottom: '10px' }}>
          Tốc độ gói tin - Packets Per Second (PPS)
        </h3>
        <div style={{ height: '200px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={mockNetworkData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="time" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="pps" stroke="#ef4444" name="Tốc độ gói tin (PPS)" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default NetworkPerformance;