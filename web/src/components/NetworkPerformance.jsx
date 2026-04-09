// NetworkPerformance.jsx: Component hiển thị Hai biểu đồ (Throughput Mbps và PPS) thể hiện thông lượng mạng biến động liên tục theo thời gian thực.
import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { dashboardAPI } from '../lib/api';

const NetworkPerformance = ({ selectedIp }) => {
  const [networkData, setNetworkData] = useState([]);
  
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
        <div style={{ width: '100%', overflowX: 'auto', overflowY: 'hidden', paddingBottom: '10px' }}>
          <div style={{ width: `${chartWidth}px`, height: '200px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={networkData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="time" />
                <YAxis />
                <Tooltip />
                <Line 
                  type="monotone" 
                  dataKey="bandwidthUp" 
                  stroke="#10b981" 
                  name="Upload (Mbps)" 
                  strokeWidth={2} 
                  dot={false}
                  isAnimationActive={false} 
                />
                <Line 
                  type="monotone" 
                  dataKey="bandwidthDown" 
                  stroke="#3b82f6" 
                  name="Download (Mbps)" 
                  strokeWidth={2} 
                  dot={false}
                  isAnimationActive={false} 
                />
              </LineChart>
            </ResponsiveContainer>
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
        <div style={{ width: '100%', overflowX: 'auto', overflowY: 'hidden', paddingBottom: '10px' }}>
          <div style={{ width: `${chartWidth}px`, height: '200px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={networkData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="time" />
                <YAxis />
                <Tooltip />
                <Line 
                  type="monotone" 
                  dataKey="ppsOut" 
                  stroke="#f59e0b" 
                  name="PPS Out" 
                  strokeWidth={2} 
                  dot={false}
                  isAnimationActive={false} 
                />
                <Line 
                  type="monotone" 
                  dataKey="ppsIn" 
                  stroke="#8b5cf6" 
                  name="PPS In" 
                  strokeWidth={2} 
                  dot={false}
                  isAnimationActive={false} 
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NetworkPerformance;