// NetworkPerformance.jsx: Component hiển thị Hai biểu đồ (Throughput Mbps và PPS) thể hiện thông lượng mạng biến động liên tục theo thời gian thực.
import { useState, useEffect, useRef } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { dashboardAPI } from '../lib/api';

const NetworkPerformance = ({ selectedIp }) => {
  const [networkData, setNetworkData] = useState([]);
  const scrollRef1 = useRef(null);
  const scrollRef2 = useRef(null);
  
  useEffect(() => {
    const fetchData = async () => {
      if (!selectedIp) return;

      const data = await dashboardAPI.getMetrics();
      if (data && data[selectedIp]) {
        const deviceData = data[selectedIp];

        const timeString = new Date().toLocaleTimeString('vi-VN');
        
        setNetworkData(prevData => {
          const newDataPoint = {
            time: timeString,
            bandwidthDown: Math.round((deviceData.downKbps / 1024) * 100) / 100,
            bandwidthUp: Math.round((deviceData.upKbps / 1024) * 100) / 100,
            ppsIn: deviceData.inPps,
            ppsOut: deviceData.outPps
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
    const threshold = 100; // Ngưỡng để xác định "đang ở cuối" (đủ cho 1-2 điểm dữ liệu mới)
    
    if (scrollRef1.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef1.current;
      const isAtEnd = scrollWidth - scrollLeft - clientWidth < threshold;
      if (isAtEnd) scrollRef1.current.scrollLeft = scrollRef1.current.scrollWidth;
    }
    
    if (scrollRef2.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollRef2.current;
      const isAtEnd = scrollWidth - scrollLeft - clientWidth < threshold;
      if (isAtEnd) scrollRef2.current.scrollLeft = scrollRef2.current.scrollWidth;
    }
  }, [networkData]);

  const chartWidth = Math.max(800, networkData.length * 60);

  return (
    <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
      <h2 style={{ fontSize: '18px', marginBottom: '20px', color: '#1f2937' }}>
        Network Performance
      </h2>
      
      {/* Biểu đồ 1: Băng thông (Throughput) */}
      <div style={{ marginBottom: '30px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <h3 style={{ fontSize: '14px', color: '#4b5563', margin: 0 }}>
            Throughput (Mbps)
          </h3>
          <div style={{ display: 'flex', gap: '15px', fontSize: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <div style={{ width: '12px', height: '12px', borderRadius: '2px', backgroundColor: '#3b82f6' }}></div>
              <span>Download (Mbps)</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <div style={{ width: '12px', height: '12px', borderRadius: '2px', backgroundColor: '#10b981' }}></div>
              <span>Upload (Mbps)</span>
            </div>
          </div>
        </div>
        {/* Y-axis cố định + chart cuộn */}
        <div style={{ display: 'flex', alignItems: 'stretch' }}>
          {/* Cột trái: Y-axis cố định - dùng fixed dimension, không ResponsiveContainer */}
          <div style={{ width: '60px', flexShrink: 0, overflow: 'hidden' }}>
            <LineChart width={60} height={200} data={networkData} margin={{ top: 5, right: 0, left: 0, bottom: 30 }}>
              <YAxis tick={{ fontSize: 12 }} width={55} />
              {/* Line ẩn để Recharts tính đúng domain */}
              <Line dataKey="bandwidthUp" stroke="transparent" dot={false} legendType="none" isAnimationActive={false} />
              <Line dataKey="bandwidthDown" stroke="transparent" dot={false} legendType="none" isAnimationActive={false} />
            </LineChart>
          </div>
          {/* Cột phải: chart cuộn, ẩn Y-axis */}
          <div ref={scrollRef1} style={{ flex: 1, overflowX: 'auto', overflowY: 'hidden', paddingBottom: '10px' }}>
            <div style={{ width: `${chartWidth}px`, height: '200px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={networkData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="time" tick={{ fontSize: 12 }} />
                  <YAxis hide />
                  <Tooltip />
                  <Line type="monotone" dataKey="bandwidthUp" stroke="#10b981" name="Upload (Mbps)" strokeWidth={2} dot={false} isAnimationActive={false} />
                  <Line type="monotone" dataKey="bandwidthDown" stroke="#3b82f6" name="Download (Mbps)" strokeWidth={2} dot={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      {/* Biểu đồ 2: Tốc độ gói tin (PPS) */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
          <h3 style={{ fontSize: '14px', color: '#4b5563', margin: 0 }}>
            Packets Per Second (PPS)
          </h3>
          <div style={{ display: 'flex', gap: '15px', fontSize: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <div style={{ width: '12px', height: '12px', borderRadius: '2px', backgroundColor: '#8b5cf6' }}></div>
              <span>PPS In</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <div style={{ width: '12px', height: '12px', borderRadius: '2px', backgroundColor: '#f59e0b' }}></div>
              <span>PPS Out</span>
            </div>
          </div>
        </div>
        {/* Y-axis cố định + chart cuộn */}
        <div style={{ display: 'flex', alignItems: 'stretch' }}>
          {/* Cột trái: Y-axis cố định - dùng fixed dimension */}
          <div style={{ width: '60px', flexShrink: 0, overflow: 'hidden' }}>
            <LineChart width={60} height={200} data={networkData} margin={{ top: 5, right: 0, left: 0, bottom: 30 }}>
              <YAxis tick={{ fontSize: 12 }} width={55} />
              {/* Line ẩn để Recharts tính đúng domain */}
              <Line dataKey="ppsOut" stroke="transparent" dot={false} legendType="none" isAnimationActive={false} />
              <Line dataKey="ppsIn" stroke="transparent" dot={false} legendType="none" isAnimationActive={false} />
            </LineChart>
          </div>
          {/* Cột phải: chart cuộn, ẩn Y-axis */}
          <div ref={scrollRef2} style={{ flex: 1, overflowX: 'auto', overflowY: 'hidden', paddingBottom: '10px' }}>
            <div style={{ width: `${chartWidth}px`, height: '200px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={networkData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="time" tick={{ fontSize: 12 }} />
                  <YAxis hide />
                  <Tooltip />
                  <Line type="monotone" dataKey="ppsOut" stroke="#f59e0b" name="PPS Out" strokeWidth={2} dot={false} isAnimationActive={false} />
                  <Line type="monotone" dataKey="ppsIn" stroke="#8b5cf6" name="PPS In" strokeWidth={2} dot={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NetworkPerformance;