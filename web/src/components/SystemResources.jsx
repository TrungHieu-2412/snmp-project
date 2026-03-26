import React, { useState, useEffect } from 'react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell
} from 'recharts';
import { dashboardAPI } from '../lib/api';


const SystemResources = () => {
  // State lưu trữ mảng dữ liệu vẽ biểu đồ CPU/RAM
  const [resourceData, setResourceData] = useState([]);
  
  // State lưu trữ số lượng kết nối TCP cho đồng hồ (Gauge)
  const [tcpConnections, setTcpConnections] = useState(0);

  useEffect(() => {
    // Hàm gọi API và cập nhật dữ liệu
    const fetchData = async () => {
      const data = await dashboardAPI.getMetrics();
      if (data) {
        // Lấy giờ hiện tại (HH:mm:ss)
        const timeString = new Date().toLocaleTimeString('vi-VN');
        
        // 1. Cập nhật mảng data cho CPU và RAM
        setResourceData(prevData => {
          const newDataPoint = {
            time: timeString,
            cpu: data.cpu,
            ram: data.ram
          };
          
          // Giữ lại 15 điểm dữ liệu gần nhất để biểu đồ dịch chuyển trơn tru
          const updatedList = [...prevData, newDataPoint];
          return updatedList.length > 15 ? updatedList.slice(updatedList.length - 15) : updatedList;
        });

        // 2. Cập nhật số kết nối TCP cho đồng hồ đo
        setTcpConnections(data.tcp || 0); 
      }
    };

    // Gọi lần đầu tiên ngay khi render
    fetchData();

    // Lập lịch gọi lại mỗi 5 giây
    const intervalId = setInterval(fetchData, 5000);

    // Dọn dẹp interval khi component bị hủy
    return () => clearInterval(intervalId);
  }, []);

  const maxTcpScale = 200; // Thang đo tối đa của đồng hồ
  const gaugeData = [
    { name: 'Kết nối hiện tại', value: tcpConnections },
      { name: 'Trống', value: Math.max(0, maxTcpScale - tcpConnections) }
  ];

  // Màu sắc: Đỏ nếu vượt 100 (báo động), Xanh lá nếu an toàn
  const gaugeColor = tcpConnections > 100 ? '#ef4444' : '#10b981';

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
              {/* THAY THẾ mockResourceData BẰNG resourceData TỪ API */}
              <LineChart data={resourceData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="time" />
                <YAxis domain={[0, 100]} />
                <Tooltip />
                <Legend />
                {/* Thêm isAnimationActive={false} để biểu đồ chạy mượt hơn, không bị giật lag khi re-render */}
                <Line type="monotone" dataKey="cpu" stroke="#ef4444" name="Tải CPU (%)" strokeWidth={2} isAnimationActive={false} />
                <Line type="monotone" dataKey="ram" stroke="#8b5cf6" name="Tải RAM (%)" strokeWidth={2} isAnimationActive={false} />
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
                  isAnimationActive={false}
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
                {tcpConnections}
              </div>
              <div style={{ fontSize: '12px', color: '#6b7280' }}>Kết nối đang mở</div>
            </div>
          </div>
        </div>
        
      </div>
    );
};

export default SystemResources;