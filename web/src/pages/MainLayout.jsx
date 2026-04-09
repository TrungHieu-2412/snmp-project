// MainLayout.jsx: Giao diện chính bao bọc thanh điều hướng (TopHeader) và sử dụng thẻ Outlet để hiển thị nội dung các trang con (Overview/Benchmark/Topology).
import { useState, useEffect } from 'react';
import { Outlet, useSearchParams } from 'react-router-dom';
import TopHeader from '../components/TopHeader';
import { dashboardAPI } from '../lib/api';

const MainLayout = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedIp = searchParams.get('ip');
  const [ips, setIps] = useState([]);

  // Gọi API lấy các Agent IP hợp lệ mỗi 3 giây, và tự động chọn IP mặc định
  useEffect(() => {
    const fetchIps = async () => {
      const data = await dashboardAPI.getMetrics();
      if (data) {
        const activeAgents = Object.keys(data).map(ip => ({
          ip: ip,
          sysName: data[ip].sysName || "Unknown OS"
        }));
        setIps(activeAgents);
        
        if (activeAgents.length > 0 && !selectedIp) {
            setSearchParams({ ip: activeAgents[0].ip });
        }
      }
    };
    
    fetchIps();

    const intervalId = setInterval(fetchIps, 3000);
    return () => clearInterval(intervalId);
  }, [selectedIp, setSearchParams]);

  const handleAddIpSuccess = (newIp) => {
    if (!ips.find(a => a.ip === newIp)) {
      setIps(prev => [...prev, { ip: newIp, sysName: "Loading OS..." }]);
    }
    setSearchParams({ ip: newIp });
  };

  const currentSysName = ips.find(a => a.ip === selectedIp)?.sysName || '';

  return (
    <div style={{ backgroundColor: '#f0f2f5', minHeight: '100vh', fontFamily: 'sans-serif' }}>
      <TopHeader 
        ips={ips} 
        selectedIp={selectedIp} 
        onAddIpSuccess={handleAddIpSuccess}
      />

      <div style={{ padding: '20px' }}>
        <div style={{ textAlign: 'center', marginBottom: '30px' }}>
          <h1 style={{ fontSize: '28px', lineHeight: '1.5', margin: 0, color: '#1f2937' }}>
            SNMP MONITORING & IDS SYSTEM (IDPS)
          </h1>
          <p style={{ color: '#6b7280', fontSize: '16px', marginTop: '3px' }}>
            Network Performance Assessment Dashboard | Monitoring Device: <strong>{selectedIp ? `${selectedIp} - ${currentSysName}` : 'Not configured'}</strong>
          </p>
        </div>

        <Outlet context={{ ips, selectedIp }} />
        
      </div>
    </div>
  );
};

export default MainLayout;