import React, { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { dashboardAPI } from '../lib/api';

const NetworkPerformance = ({ selectedIp }) => {
  const [networkData, setNetworkData] = useState([]); // State lưu trữ mảng dữ liệu vẽ biểu đồ
  
  useEffect(() => {
    // Hàm gọi API và cập nhật dữ liệu
    const fetchData = async () => {
      if (!selectedIp) return; // Chưa chọn IP thì bỏ qua

      const data = await dashboardAPI.getMetrics();
      if (data && data[selectedIp]) {
        const deviceData = data[selectedIp];

        // Lấy giờ hiện tại (HH:mm:ss)
        const timeString = new Date().toLocaleTimeString('vi-VN');
        
        // Cập nhật mảng data mới
        setNetworkData(prevData => {
          const newDataPoint = {
            time: timeString,
            bandwidthDown: Math.round((deviceData.downKbps / 1024) * 100) / 100,
            bandwidthUp: Math.round((deviceData.upKbps / 1024) * 100) / 100,
            ppsIn: deviceData.inPps,
            ppsOut: deviceData.outPps
          };
          
          // Giữ lại 15 điểm dữ liệu gần nhất để biểu đồ không bị tràn màn hình
          const updatedList = [...prevData, newDataPoint];
          return updatedList.length > 15 ? updatedList.slice(updatedList.length - 15) : updatedList;
        });
      }
    };

    // Gọi lần đầu tiên ngay khi render
    fetchData();

    // Lập lịch gọi lại mỗi 5 giây (Khớp với tốc độ Poller của BE)
    const intervalId = setInterval(fetchData, 5000);

    // Dọn dẹp interval khi component bị hủy
    return () => clearInterval(intervalId);
  }, [selectedIp]);
  
  return (
    <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
      <h2 style={{ fontSize: '18px', marginBottom: '20px', color: '#1f2937' }}>
        Giám sát Hiệu năng Mạng (Network Performance)
      </h2>
      
      {/* Biểu đồ 1: Băng thông (Throughput) */}
      <div style={{ marginBottom: '30px' }}>
        <h3 style={{ fontSize: '14px', color: '#4b5563', marginBottom: '10px' }}>
          Lưu lượng Băng thông - Throughput (Mbps)
        </h3>
        <div style={{ height: '200px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={networkData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="time" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="bandwidthUp" 
                stroke="#10b981" 
                name="Tải lên (Mbps)" 
                strokeWidth={2} 
                dot={false}
                isAnimationActive={false} 
              />
              <Line 
                type="monotone" 
                dataKey="bandwidthDown" 
                stroke="#3b82f6" 
                name="Tải xuống (Mbps)" 
                strokeWidth={2} 
                dot={false}
                isAnimationActive={false} 
              />
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
            <LineChart data={networkData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="time" />
              <YAxis />
              <Tooltip />
              <Legend />
              <Line 
                type="monotone" 
                dataKey="ppsOut" 
                stroke="#f59e0b" 
                name="Gói ra (PPS Out)" 
                strokeWidth={2} 
                dot={false}
                isAnimationActive={false} 
              />
              <Line 
                type="monotone" 
                dataKey="ppsIn" 
                stroke="#8b5cf6" 
                name="Gói vào (PPS In)" 
                strokeWidth={2} 
                dot={false}
                isAnimationActive={false} 
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default NetworkPerformance;