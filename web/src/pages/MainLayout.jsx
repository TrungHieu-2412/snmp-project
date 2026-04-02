import React, { useState, useEffect } from 'react';
import { Outlet, useSearchParams } from 'react-router-dom';
import TopHeader from '../components/TopHeader';
import { dashboardAPI } from '../lib/api';

const MainLayout = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedIp = searchParams.get('ip');
  const [ips, setIps] = useState([]);

  // Fetch dữ liệu Metrics mỗi 5s để lấy danh sách IP thả xuống (đồng bộ backend)
  useEffect(() => {
    const fetchIps = async () => {
      const data = await dashboardAPI.getMetrics();
      if (data) {
        const activeAgents = Object.keys(data).map(ip => ({
          ip: ip,
          sysName: data[ip].sysName || "Unknown OS"
        }));
        setIps(activeAgents);
        
        // Cập nhật selectedIp lần đầu tiên nếu nó đang rỗng
        if (activeAgents.length > 0 && !selectedIp) {
            setSearchParams({ ip: activeAgents[0].ip });
        }
      }
    };
    
    // Gọi ngay lần đầu
    fetchIps();

    // Tiếp tục gọi để bắt IP mới nếu có
    const intervalId = setInterval(fetchIps, 5000);
    return () => clearInterval(intervalId);
  }, [selectedIp, setSearchParams]);

  // Xử lý khi người dùng thêm IP mới trên header thành công
  const handleAddIpSuccess = (newIp) => {
    if (!ips.find(a => a.ip === newIp)) {
      setIps(prev => [...prev, { ip: newIp, sysName: "Đang tải hệ điều hành..." }]);
    }
    // Tự động rẽ nhánh sang IP vừa thêm
    setSearchParams({ ip: newIp });
  };

  const currentSysName = ips.find(a => a.ip === selectedIp)?.sysName || '';

  return (
    <div style={{ backgroundColor: '#f0f2f5', minHeight: '100vh', fontFamily: 'sans-serif' }}>
      
      {/* THANH ĐIỀU HƯỚNG MỚI */}
      <TopHeader 
        ips={ips} 
        selectedIp={selectedIp} 
        onAddIpSuccess={handleAddIpSuccess}
      />

      <div style={{ padding: '20px' }}>
        {/* Tiêu đề trang Web */}
        <div style={{ textAlign: 'center', marginBottom: '30px' }}>
          <h1 style={{ fontSize: '28px', lineHeight: '1.5', margin: 0, color: '#1f2937' }}>
            HỆ THỐNG GIÁM SÁT VÀ PHÒNG THỦ SNMP (IDPS)
          </h1>
          <p style={{ color: '#6b7280', fontSize: '16px', marginTop: '5px' }}>
            Dashboard Đánh giá Hiệu năng Hệ thống Mạng | Thiết bị đang giám sát: <strong>{selectedIp ? `${selectedIp} - ${currentSysName}` : 'Chưa thiết lập'}</strong>
          </p>
        </div>
        
        {/* Nội dung Tương ứng theo Tab (Qua thẻ Outlet) */}
        <Outlet context={{ ips, selectedIp }} />
        
      </div>
    </div>
  );
};

export default MainLayout;
