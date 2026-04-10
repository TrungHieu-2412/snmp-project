// NetworkTopology.jsx: Component hiển thị Sơ đồ Mạng (Topology) với luồng gói tin thời gian thực giữa các VM.
import React, { useState, useEffect } from 'react';
import { Server, Activity, ArrowDown, ArrowUp, Shield, ShieldAlert, Swords } from 'lucide-react';
import { dashboardAPI } from '../lib/api';

// NodeCard: Thẻ hiển thị thông tin của từng VM node.
const NodeCard = ({ title, ip, data, color, isVictim, isUnderAttack, isAttacker }) => {
  // Xác định biểu tượng bên trái dựa trên vai trò
  const renderLeftIcon = () => {
    if (isVictim) {
      return isUnderAttack ? <ShieldAlert size={24} color="#ef4444" style={{ marginRight: '10px' }} /> : <Shield size={24} color="#10b981" style={{ marginRight: '10px' }} />;
    }
    if (isAttacker) {
      return <Swords size={24} color="#ef4444" style={{ marginRight: '10px' }} />;
    }
    return <Server size={24} color={color} style={{ marginRight: '10px' }} />;
  };

  return (
    <div style={{
      width: '260px',
      backgroundColor: '#ffffff',
      borderTop: `4px solid ${color}`,
      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
      borderRadius: '8px',
      padding: '15px',
      position: 'relative'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          {renderLeftIcon()}
          <div>
            <h3 style={{ margin: 0, fontSize: '16px', color: '#1f2937' }}>{title}</h3>
            <span style={{ fontSize: '12px', color: '#6b7280' }}>{ip}</span>
          </div>
        </div>
      </div>

    {data && data.status !== 'OFFLINE' ? (
      <div style={{ fontSize: '13px', color: '#4b5563', lineHeight: '1.6' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ display: 'flex', alignItems: 'center' }}><ArrowDown size={14} color="#10b981" style={{ marginRight: '4px' }} />Down:</span>
          <strong>{data.downKbps || 0} Kbps</strong>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span style={{ display: 'flex', alignItems: 'center' }}><ArrowUp size={14} color="#3b82f6" style={{ marginRight: '4px' }} />Up:</span>
          <strong>{data.upKbps || 0} Kbps</strong>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '5px' }}>
          <span>In (Packets):</span>
          <strong style={{ color: data.inPps > 5000 ? '#ef4444' : '#1f2937' }}>{data.inPps || 0} pps</strong>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
          <span>Out (Packets):</span>
          <strong>{data.outPps || 0} pps</strong>
        </div>
      </div>
    ) : (
      <div style={{ fontSize: '13px', color: '#9ca3af', textAlign: 'center', padding: '20px 0' }}>Waiting for data...</div>
    )}
    </div>
  );
};

const NetworkTopology = () => {
  const [metrics, setMetrics] = useState({});

  useEffect(() => {
    let ignore = false; // Cờ tránh setState khi component đã unmount

    const load = async () => {
      const data = await dashboardAPI.getTopologyMetrics();
      if (!ignore && data) setMetrics(data);
    };

    load();
    const interval = setInterval(load, 3000);
    return () => {
      ignore = true;
      clearInterval(interval);
    };
  }, []);

  const attackerOut = metrics['10.0.2.2']?.outPps || 0;
  const victimIn = metrics['10.0.1.2']?.inPps || 0;

  const isAttacking = attackerOut > 5000;
  const isUnderAttack = victimIn > 5000;

  return (
    <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '30px' }}>
        <h2 style={{ fontSize: '18px', color: '#1f2937', margin: 0 }}>Network Topology & Packet Flow</h2>
      </div>

      <div style={{ position: 'relative', width: '100%', height: '550px', display: 'flex', justifyContent: 'center' }}>

        {/* --- DÂY VÀ GÓI TIN (Z-INDEX 0) --- */}
        <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 0 }}>

          {/* Dây cáp kết nối */}
          {/* VM2 -> VM1 */}
          <line x1="50%" y1="180" x2="25%" y2="350" stroke="#d1d5db" strokeWidth="2" strokeDasharray="5,5" />
          {/* VM2 -> VM3 */}
          <line x1="50%" y1="180" x2="75%" y2="350" stroke="#d1d5db" strokeWidth="2" strokeDasharray="5,5" />
          {/* VM3 -> VM1 */}
          <line x1="75%" y1="420" x2="25%" y2="420" stroke={isAttacking ? '#fca5a5' : '#e5e7eb'} strokeWidth="3" strokeDasharray="4,4" />

          {/* SNMP Polling (Màu Xanh - Luôn chạy) */}
          {/* Gửi GET từ VM2 xuống VM1 */}
          <circle r="4" fill="#3b82f6">
            <animate attributeName="cx" values="50%;25%" dur="3s" repeatCount="indefinite" />
            <animate attributeName="cy" values="180;350" dur="3s" repeatCount="indefinite" />
          </circle>
          {/* Gửi RESPONSE từ VM1 lên VM2 */}
          <circle r="4" fill="#60a5fa">
            <animate attributeName="cx" values="25%;50%" dur="3s" repeatCount="indefinite" begin="1.5s" />
            <animate attributeName="cy" values="350;180" dur="3s" repeatCount="indefinite" begin="1.5s" />
          </circle>

          {/* Gửi GET từ VM2 xuống VM3 */}
          <circle r="4" fill="#3b82f6">
            <animate attributeName="cx" values="50%;75%" dur="3s" repeatCount="indefinite" />
            <animate attributeName="cy" values="180;350" dur="3s" repeatCount="indefinite" />
          </circle>

          {/* Gói tin Tấn Công (Màu Đỏ - VM3 sang VM1) */}
          {isAttacking && (
            <circle r="6" fill="#ef4444">
              <animate attributeName="cx" values="75%;25%" dur="0.2s" repeatCount="indefinite" />
              <animate attributeName="cy" values="420;420" dur="0.2s" repeatCount="indefinite" />
            </circle>
          )}

          {/* Gói tin TRAP Báo Động (Màu Cam - VM1 lên VM2) */}
          {isUnderAttack && (
            <circle r="7" fill="#f59e0b">
              <animate attributeName="cx" values="25%;50%" dur="0.8s" repeatCount="indefinite" />
              <animate attributeName="cy" values="350;180" dur="0.8s" repeatCount="indefinite" />
            </circle>
          )}
        </svg>

        {/* Node Manager (VM2) */}
        <div style={{ position: 'absolute', top: '20px', left: '50%', transform: 'translateX(-50%)', zIndex: 10 }}>
          <NodeCard
            title="VM2 - NMS Manager"
            ip="10.0.1.3"
            color="#4f46e5"
            data={{ downKbps: 'N/A', upKbps: 'N/A', inPps: 'N/A', outPps: 'N/A' }}
          />
        </div>

        {/* Node Victim (VM1) */}
        <div style={{ position: 'absolute', top: '350px', left: '25%', transform: 'translateX(-50%)', zIndex: 10 }}>
          <NodeCard
            title="VM1 - Web Server"
            ip="10.0.1.2"
            color="#10b981"
            data={metrics['10.0.1.2']}
            isVictim={true}
            isUnderAttack={isUnderAttack}
          />
        </div>

        {/* Node Attacker (VM3) */}
        <div style={{ position: 'absolute', top: '350px', left: '75%', transform: 'translateX(-50%)', zIndex: 10 }}>
          <NodeCard
            title="VM3 - Attacker"
            ip="10.0.2.2"
            color="#ef4444"
            data={metrics['10.0.2.2']}
            isAttacker={true}
          />
        </div>
      </div>
    </div>
  );
};

export default NetworkTopology;