import React from 'react';
import NetworkPerformance from './components/NetworkPerformance';
import SystemResources from './components/SystemResources'; 
import ControlPanel from './components/ControlPanel';
import EvaluationLogs from './components/EvaluationLogs';

function App() {
  return (
    <div style={{ padding: '20px', backgroundColor: '#f0f2f5', minHeight: '100vh', fontFamily: 'sans-serif' }}>
      
      {/* Tiêu đề trang Web */}
      <div style={{ textAlign: 'center', marginBottom: '30px' }}>
        <h1 style={{ fontSize: '28px', lineHeight: '1.5', margin: 0, color: '#1f2937' }}>
          HỆ THỐNG GIÁM SÁT VÀ PHÒNG THỦ SNMP (IDPS)
        </h1>
        <p style={{ color: '#6b7280', fontSize: '16px', marginTop: '5px' }}>
          Dashboard Đánh giá Hiệu năng Hệ thống Mạng
        </p>
      </div>
      
      {/* Layout Grid chia 2 cột */}
      <div style={{ 
        display: 'grid', 
        gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', 
        gap: '20px' 
      }}>
        
        {/* --- KHU VỰC 1: Network --- */}
        <NetworkPerformance />

        {/* --- KHU VỰC 2: Tài nguyên (Đã lắp vào) --- */}
        <SystemResources />

        {/* --- KHU VỰC 3: Chờ thiết kế --- */}
        <ControlPanel />

        {/* --- KHU VỰC 4: Chờ thiết kế --- */}
        <EvaluationLogs />

      </div>
    </div>
  );
}

export default App;