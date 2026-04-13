// SystemResources.jsx: Component hiển thị Biểu đồ đường vẽ mức tiêu thụ CPU & RAM.
import { useState, useEffect, useRef } from 'react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';
import { dashboardAPI } from '../lib/api';


const SystemResources = ({ selectedIp }) => {
  const [resourceData, setResourceData] = useState([]);
  const scrollRef = useRef(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!selectedIp) return;

      const data = await dashboardAPI.getMetrics();
      if (data && data[selectedIp]) {
        const deviceData = data[selectedIp];
        const timeString = new Date().toLocaleTimeString('vi-VN');
        
        setResourceData(prevData => {
          const newDataPoint = {
            time: timeString,
            cpu: deviceData.cpu,
            ram: deviceData.ram
          };
          
          const updatedList = [...prevData, newDataPoint];
          return updatedList.length > 100 ? updatedList.slice(updatedList.length - 100) : updatedList;
        });
      }
    };

    fetchData();

    const intervalId = setInterval(fetchData, 3000);

    return () => clearInterval(intervalId);
  }, [selectedIp]);

  // Tự động cuộn đến cuối mỗi khi dữ liệu cập nhật (chỉ cuộn nếu người dùng đang ở cuối)
  useEffect(() => {
    const threshold = 100; // Ngưỡng để xác định "đang ở cuối"
    
    if (scrollRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current;
      // Nếu khoảng cách đến cuối biểu đồ nhỏ hơn threshold, coi như người dùng muốn auto-scroll
      const isAtEnd = scrollWidth - scrollLeft - clientWidth < threshold;
      if (isAtEnd) {
        scrollRef.current.scrollLeft = scrollRef.current.scrollWidth;
      }
    }
  }, [resourceData]);

  const chartWidth = Math.max(800, resourceData.length * 60);

  return (
      <div style={{ backgroundColor: 'white', padding: '10px 20px 20px 20px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
        <h2 style={{ fontSize: '18px', marginBottom: '20px', color: '#1f2937' }}>
          System Resources
        </h2>
        
        {/* Biểu đồ 1: Tải CPU & RAM */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <h3 style={{ fontSize: '14px', color: '#4b5563', margin: 0 }}>
              CPU & RAM Utilization (%)
            </h3>
            <div style={{ display: 'flex', gap: '15px', fontSize: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <div style={{ width: '12px', height: '12px', borderRadius: '2px', backgroundColor: '#ef4444' }}></div>
                <span>CPU Load (%)</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <div style={{ width: '12px', height: '12px', borderRadius: '2px', backgroundColor: '#8b5cf6' }}></div>
                <span>RAM Load (%)</span>
              </div>
            </div>
          </div>
          {/* Y-axis cố định + chart cuộn */}
          <div style={{ display: 'flex', alignItems: 'stretch' }}>
            {/* Cột trái: Y-axis cố định - dùng fixed dimension */}
            <div style={{ width: '60px', flexShrink: 0, overflow: 'hidden' }}>
              <LineChart width={60} height={200} data={resourceData} margin={{ top: 5, right: 0, left: 0, bottom: 30 }}>
                <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} width={55} />
                {/* Line ẩn để Recharts hiểu cấu trúc dữ liệu */}
                <Line dataKey="cpu" stroke="transparent" dot={false} legendType="none" isAnimationActive={false} />
                <Line dataKey="ram" stroke="transparent" dot={false} legendType="none" isAnimationActive={false} />
              </LineChart>
            </div>
            {/* Cột phải: chart cuộn, ẩn Y-axis */}
            <div ref={scrollRef} style={{ flex: 1, overflowX: 'auto', overflowY: 'hidden', paddingBottom: '10px' }}>
              <div style={{ width: `${chartWidth}px`, height: '200px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={resourceData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="time" tick={{ fontSize: 12 }} />
                    <YAxis domain={[0, 100]} hide />
                    <Tooltip />
                    <Line type="monotone" dataKey="cpu" stroke="#ef4444" name="CPU Load (%)" strokeWidth={2} dot={false} isAnimationActive={false} />
                    <Line type="monotone" dataKey="ram" stroke="#8b5cf6" name="RAM Load (%)" strokeWidth={2} dot={false} isAnimationActive={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      </div>
  );
};

export default SystemResources;