import React, { useState } from 'react';
import { Dropdown, Input, Button, message } from 'antd';
import { dashboardAPI } from '../lib/api';
import { Server, Activity, Share2, Plus, Zap, ChevronDown } from 'lucide-react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';

const TopHeader = ({ ips, selectedIp, onAddIpSuccess }) => {
  const [newIp, setNewIp] = useState("");
  const [loading, setLoading] = useState(false);
  const location = useLocation();
  const currentPath = location.pathname;
  const [, setSearchParams] = useSearchParams();

  // Tạo giao diện mở trong Tab mới khi ấn chuột phải
  const menuItems = ips.map(agent => ({
    key: agent.ip,
    label: (
      <a 
        href={`?ip=${agent.ip}`} 
        onClick={(e) => {
          // Chuột trái chạy React Router Push state thay thế href native
          if (e.button === 0 && !e.ctrlKey && !e.metaKey && !e.shiftKey) {
            e.preventDefault();
            setSearchParams({ ip: agent.ip });
          }
        }}
        style={{ fontSize: '14px', padding: '4px 8px', display: 'block', fontWeight: selectedIp === agent.ip ? 'bold' : 'normal', color: '#1f2937' }}
      >
        {agent.ip} - {agent.sysName}
      </a>
    )
  }));

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

  const selectedAgent = ips.find(a => a.ip === selectedIp);
  const displayLabel = selectedAgent ? `${selectedAgent.ip} - ${selectedAgent.sysName}` : "Chọn VM Agent...";

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
        
        <Dropdown menu={{ items: menuItems }} trigger={['click']}>
          <Button style={{ width: 'auto', minWidth: 160, display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderColor: 'transparent' }}>
            <span style={{ fontWeight: 500 }}>{displayLabel}</span>
            <ChevronDown size={14} style={{ opacity: 0.6, marginLeft: '8px' }} />
          </Button>
        </Dropdown>

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
        <TabLink 
          to={`/${selectedIp ? `?ip=${selectedIp}` : ''}`} 
          active={currentPath === '/'} 
          icon={<Activity size={18} />}
          label="Overview"
        />
        <TabLink 
          to={`/benchmark${selectedIp ? `?ip=${selectedIp}` : ''}`} 
          active={currentPath === '/benchmark'} 
          icon={<Zap size={18} />}
          label="Benchmark"
        />
        <TabLink 
          to={`/topology${selectedIp ? `?ip=${selectedIp}` : ''}`} 
          active={currentPath === '/topology'} 
          icon={<Share2 size={18} />}
          label="Topology"
        />
      </div>
    </div>
  );
};

// Component con Nút bấm tuỳ chỉnh (Tab Header)
const TabLink = ({ to, active, icon, label }) => {
  return (
    <Link to={to} style={{ textDecoration: 'none' }}>
      <button 
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
    </Link>
  );
};

export default TopHeader;
