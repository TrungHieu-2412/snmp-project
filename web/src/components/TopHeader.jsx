import React, { useState } from 'react';
import { Select, Input, Button, message } from 'antd';
import { dashboardAPI } from '../lib/api';
import { Server, Activity, Share2, Plus, Zap } from 'lucide-react';

const TopHeader = ({ ips, selectedIp, onSelectIp, activeTab, onSelectTab, onAddIpSuccess }) => {
  const [newIp, setNewIp] = useState("");
  const [loading, setLoading] = useState(false);

  const handleAddIp = async () => {
    if (!newIp.trim()) {
      message.error("Vui lòng nhập định dạng IP hợp lệ!");
      return;
    }
    setLoading(true);
    const success = await dashboardAPI.addNewDevice(newIp.trim());
    if (success) {
      message.success(`Đã thêm IP ${newIp} vào hệ thống giám sát!`);
      setNewIp("");
      if (onAddIpSuccess) onAddIpSuccess(newIp.trim());
    } else {
      message.error("Thêm IP mới thất bại hoặc bị từ chối kết nối.");
    }
    setLoading(false);
  };

  return (
    <div style={{ 
      backgroundColor: '#1e3a8a', 
      padding: '12px 24px', 
      display: 'flex', 
      justifyContent: 'space-between', 
      alignItems: 'center', 
      boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
      position: 'sticky',
      top: 0,
      zIndex: 1000
    }}>
      {/* Khu vực bên trái: Chọn IP và Thêm IP */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
        <h3 style={{ margin: 0, color: 'white', fontWeight: 600, fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Server size={20} /> SNMP Manager
        </h3>
        
        <Select
          value={selectedIp}
          onChange={onSelectIp}
          style={{ width: 160 }}
          options={ips.map(ip => ({ label: ip, value: ip }))}
          placeholder="Chọn VM Agent..."
          notFoundContent="Chưa có thiết bị nào"
        />

        <div style={{ display: 'flex' }}>
          <Input 
            placeholder="Nhập IP mới..." 
            value={newIp} 
            onChange={(e) => setNewIp(e.target.value)}
            onPressEnter={handleAddIp}
            style={{ width: 150, borderTopRightRadius: 0, borderBottomRightRadius: 0 }}
          />
          <Button 
            type="primary" 
            onClick={handleAddIp} 
            loading={loading}
            style={{ borderTopLeftRadius: 0, borderBottomLeftRadius: 0, backgroundColor: '#3b82f6' }}
          >
            <Plus size={16} /> Thêm
          </Button>
        </div>
      </div>

      {/* Khu vực bên phải: Điều hướng (Tabs) */}
      <div style={{ display: 'flex', gap: '10px' }}>
        <TabButton 
          active={activeTab === 'Overview'} 
          onClick={() => onSelectTab('Overview')}
          icon={<Activity size={18} />}
          label="Overview"
        />
        <TabButton 
          active={activeTab === 'Benchmark'} 
          onClick={() => onSelectTab('Benchmark')}
          icon={<Zap size={18} />}
          label="Benchmark"
        />
        <TabButton 
          active={activeTab === 'Topology'} 
          onClick={() => onSelectTab('Topology')}
          icon={<Share2 size={18} />}
          label="Topology"
        />
      </div>
    </div>
  );
};

// Component con Nút bấm tuỳ chỉnh (Tab Header)
const TabButton = ({ active, onClick, icon, label }) => {
  return (
    <button 
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        padding: '8px 16px',
        backgroundColor: active ? 'rgba(255, 255, 255, 0.2)' : 'transparent',
        color: active ? '#ffffff' : '#93c5fd',
        border: 'none',
        borderRadius: '6px',
        cursor: 'pointer',
        fontSize: '15px',
        fontWeight: active ? '600' : '500',
        transition: 'all 0.2s ease-in-out'
      }}
      onMouseOver={(e) => e.currentTarget.style.color = '#ffffff'}
      onMouseOut={(e) => { if(!active) e.currentTarget.style.color = '#93c5fd'; }}
    >
      {icon} {label}
    </button>
  );
};

export default TopHeader;
