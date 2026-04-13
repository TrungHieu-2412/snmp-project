// TcpMonitoring.jsx: Component hiển thị Đồng hồ đo hiển thị trực quan các kết nối TCP hiện tại và TCP In Segments.
import { useState, useEffect } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { dashboardAPI } from '../lib/api';

const TcpMonitoring = ({ selectedIp }) => {
  const [tcpConnections, setTcpConnections] = useState(0);
  const [tcpInSegsPps, setTcpInSegsPps] = useState(0);

  useEffect(() => {
    const fetchData = async () => {
      if (!selectedIp) return;

      const data = await dashboardAPI.getMetrics();
      if (data && data[selectedIp]) {
        const deviceData = data[selectedIp];
        setTcpConnections(deviceData.tcp || 0); 
        setTcpInSegsPps(deviceData.tcpInSegsPps || 0);
      }
    };

    fetchData();
    const intervalId = setInterval(fetchData, 3000);

    return () => clearInterval(intervalId);
  }, [selectedIp]);

  const maxTcpScale = 200;
  const gaugeData = [
    { name: 'Active Connections', value: tcpConnections },
    { name: 'Available', value: Math.max(0, maxTcpScale - tcpConnections) }
  ];

  const maxTcpSegsScale = 2000;
  const ppsGaugeData = [
    { name: 'PPS', value: tcpInSegsPps },
    { name: 'Available', value: Math.max(0, maxTcpSegsScale - tcpInSegsPps) }
  ];

  const gaugeColor = tcpConnections > 100 ? '#ef4444' : '#10b981';
  const ppsGaugeColor = tcpInSegsPps > 1000 ? '#ef4444' : '#3b82f6';

  return (
    <div style={{ backgroundColor: 'white', padding: '10px 20px 20px 20px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
      <h2 style={{ fontSize: '18px', marginBottom: '20px', color: '#1f2937' }}>
        TCP Monitoring
      </h2>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        <div>
          <h3 style={{ fontSize: '14px', color: '#4b5563', marginBottom: '0px', textAlign: 'center' }}>
            TCP Connections <br/> (Threshold: 100)
          </h3>
          <div style={{ height: '180px', position: 'relative' }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={gaugeData}
                  cx="50%"
                  cy="70%"
                  startAngle={180}
                  endAngle={0}
                  innerRadius={60}
                  outerRadius={80}
                  dataKey="value"
                  stroke="none"
                  isAnimationActive={false}
                >
                  <Cell fill={gaugeColor} />
                  <Cell fill="#e5e7eb" />
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            
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
              <div style={{ fontSize: '12px', color: '#6b7280' }}>Open Conns</div>
            </div>
          </div>
        </div>

        <div>
          <h3 style={{ fontSize: '14px', color: '#4b5563', marginBottom: '0px', textAlign: 'center' }}>
            TCP In Segments <br/> (Threshold: 1000 pps)
          </h3>
          <div style={{ height: '180px', position: 'relative' }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={ppsGaugeData}
                  cx="50%"
                  cy="70%"
                  startAngle={180}
                  endAngle={0}
                  innerRadius={60}
                  outerRadius={80}
                  dataKey="value"
                  stroke="none"
                  isAnimationActive={false}
                >
                  <Cell fill={ppsGaugeColor} />
                  <Cell fill="#e5e7eb" />
                </Pie>
              </PieChart>
            </ResponsiveContainer>
            
            <div style={{
              position: 'absolute',
              top: '60%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              textAlign: 'center'
            }}>
              <div style={{ fontSize: '32px', fontWeight: 'bold', color: ppsGaugeColor }}>
                {tcpInSegsPps}
              </div>
              <div style={{ fontSize: '12px', color: '#6b7280' }}>pps</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TcpMonitoring;
