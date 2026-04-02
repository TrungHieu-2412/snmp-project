import React, { useState, useEffect } from 'react';
import NetworkPerformance from '../components/NetworkPerformance';
import SystemResources from '../components/SystemResources'; 
import ControlPanel from '../components/ControlPanel';
import EvaluationLogs from '../components/EvaluationLogs';
import ProtocolComparison from '../components/ProtocolComparison';
import NetworkTopology from '../components/NetworkTopology';
import TopHeader from '../components/TopHeader';
import { dashboardAPI } from '../lib/api';

const MainPage = () => {
  const [activeTab, setActiveTab] = useState('Overview');
  const [selectedIp, setSelectedIp] = useState(null);
  const [ips, setIps] = useState([]);

  // Fetch dữ liệu Metrics mỗi 5s để lấy danh sách IP thả xuống (đồng bộ backend)
  useEffect(() => {
    const fetchIps = async () => {
      const data = await dashboardAPI.getMetrics();
      if (data) {
        const ipList = Object.keys(data);
        setIps(ipList);
        
        // Cập nhật selectedIp lần đầu tiên nếu nó đang rỗng
        if (ipList.length > 0 && !selectedIp) {
           setSelectedIp(ipList[0]);
        }
      }
    };
    
    // Gọi ngay lần đầu
    fetchIps();

    // Tiếp tục gọi để bắt IP mới nếu có
    const intervalId = setInterval(fetchIps, 5000);
    return () => clearInterval(intervalId);
  }, [selectedIp]);

  // Xử lý khi người dùng thêm IP mới trên header thành công
  const handleAddIpSuccess = (newIp) => {
    if (!ips.includes(newIp)) {
      setIps(prev => [...prev, newIp]);
    }
    // Tự động chuyển qua IP mới
    setSelectedIp(newIp);
  };

  return (
    <div style={{ backgroundColor: '#f0f2f5', minHeight: '100vh', fontFamily: 'sans-serif' }}>
      
      {/* THANH ĐIỀU HƯỚNG MỚI */}
      <TopHeader 
        ips={ips} 
        selectedIp={selectedIp} 
        onSelectIp={(val) => setSelectedIp(val)} 
        activeTab={activeTab} 
        onSelectTab={(val) => setActiveTab(val)}
        onAddIpSuccess={handleAddIpSuccess}
      />

      <div style={{ padding: '20px' }}>
        {/* Tiêu đề trang Web */}
        <div style={{ textAlign: 'center', marginBottom: '30px' }}>
          <h1 style={{ fontSize: '28px', lineHeight: '1.5', margin: 0, color: '#1f2937' }}>
            HỆ THỐNG GIÁM SÁT VÀ PHÒNG THỦ SNMP (IDPS)
          </h1>
          <p style={{ color: '#6b7280', fontSize: '16px', marginTop: '5px' }}>
            Dashboard Đánh giá Hiệu năng Hệ thống Mạng | Thiết bị đang giám sát: <strong>{selectedIp || 'Chưa thiết lập'}</strong>
          </p>
        </div>
        
        {/* Nội dung Tương ứng theo Tab */}
        
        {activeTab === 'Overview' && (
          <div style={{ 
            display: 'grid', 
            gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', 
            gap: '20px' 
          }}>
            {/* Thêm key={selectedIp} để React xoá sạch state khi chuyển mạng */}
            <NetworkPerformance key={`net-${selectedIp}`} selectedIp={selectedIp} />
            <SystemResources key={`sys-${selectedIp}`} selectedIp={selectedIp} />
            <ControlPanel />
            <EvaluationLogs />
          </div>
        )}

        {activeTab === 'Benchmark' && (
          <div>
            <ProtocolComparison />
          </div>
        )}

        {activeTab === 'Topology' && (
          <div>
            <NetworkTopology />
          </div>
        )}
      </div>
    </div>
  );
};

export default MainPage;