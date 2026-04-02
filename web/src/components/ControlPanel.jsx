// ControlPanel.jsx: Khối tổng hợp trạng thái An ninh mạng, hiển thị ngay hộp cảnh báo Đỏ (nếu có tấn công) và các công tắc điều chỉnh chế độ chặn Iptables.
import { useState, useEffect } from 'react';
import { Switch, Select, Button, Alert, Tag, notification } from 'antd';
import { ShieldAlert, ShieldCheck, RefreshCw, Zap } from 'lucide-react';
import { dashboardAPI } from '../lib/api';

const ControlPanel = () => {
  const [isAutoMode, setIsAutoMode] = useState(true);
  const [delay, setDelay] = useState(10);
  
  const [currentAlert, setCurrentAlert] = useState(null);
  const [isUnderAttack, setIsUnderAttack] = useState(false);

  useEffect(() => {
    const fetchAlerts = async () => {
      const alerts = await dashboardAPI.getAlerts();
      if (alerts && alerts.length > 0) {
        const latestAlert = alerts[alerts.length - 1];
        
        if (!currentAlert || latestAlert.time !== currentAlert.time) {
          setCurrentAlert(latestAlert);
          if (latestAlert.status === 'Resolved') {
            setIsUnderAttack(false);
          } else {
            setIsUnderAttack(true);
          }
        } 
        else if (latestAlert.status === 'Resolved' && isUnderAttack) {
          setIsUnderAttack(false);
          notification.success({ message: 'Auto-Defense', description: 'System successfully activated IPS shield!' });
        }
      }
    };
    const intervalId = setInterval(fetchAlerts, 5000);
    return () => clearInterval(intervalId);
  }, [currentAlert, isUnderAttack]);

  const handleDelayChange = async (value) => {
    setDelay(value);
    const success = await dashboardAPI.updateDelayConfig(value);
    if (success) {
      notification.success({ message: 'Success', description: `System updated: Delay ${value}s` });
    } else {
      notification.error({ message: 'Error', description: 'Cannot update configuration to NMS server.' });
    }
  };

  const handleAutoModeChange = async (checked) => {
    setIsAutoMode(checked);
    const success = await dashboardAPI.updateAutoModeConfig(checked);
    if (success) {
      notification.success({ message: 'Success', description: `Auto-IPS mode is now ${checked ? 'ON' : 'OFF'}.` });
    } else {
      notification.error({ message: 'Error', description: 'Cannot sync Auto mode to NMS server.' });
      setIsAutoMode(!checked);
    }
  };

  const handleManualMitigation = async () => {
    const ipToBlock = currentAlert ? currentAlert.ip : '10.0.1.2';
    const success = await dashboardAPI.mitigateAttack(ipToBlock);
    
    if (success) {
      notification.success({ message: 'Defense Successful', description: `Successfully deployed Iptables shield blocking IP ${ipToBlock}!` });
      setIsUnderAttack(false);
    } else {
      notification.error({ message: 'Error', description: 'Failed to send SET command!' });
    }
  };

  return (
    <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
      <h2 style={{ fontSize: '18px', marginBottom: '20px', color: '#1f2937' }}>
        Control and Warning Panel
      </h2>

      <div style={{ marginBottom: '20px' }}>
        {isUnderAttack && currentAlert ? (
          <Alert
            message={`WARNING: ${currentAlert.attackType.toUpperCase()} ATTACK DETECTED!`}
            description={`Target: ${currentAlert.ip} | Time: ${new Date(parseInt(currentAlert.time)).toLocaleTimeString('en-US')} | Message: ${currentAlert.message}`}
            type="error"
            showIcon
            icon={<ShieldAlert size={24} style={{ marginTop: '8px' }} />}
            action={
              <Button type="primary" danger icon={<Zap size={16} />} onClick={handleManualMitigation}>
                Stop it now!
              </Button>
            }
          />
        ) : (
          <Alert
            message="System is operating safely"
            description="No abnormal network traffic detected from external agents."
            type="success"
            showIcon
            icon={<ShieldCheck size={24} style={{ marginTop: '8px' }} />}
          />
        )}
      </div>

      <div style={{ display: 'flex', gap: '30px', padding: '15px', backgroundColor: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
        <div>
          <div style={{ marginBottom: '8px', fontWeight: 'bold', fontSize: '14px', color: '#4b5563' }}>Defense Mode:</div>
          <Switch 
            checked={isAutoMode} 
            onChange={handleAutoModeChange} 
            checkedChildren="AUTO" 
            unCheckedChildren="MANUAL"
          />
          <Tag color={isAutoMode ? 'green' : 'orange'} style={{ marginLeft: '10px' }}>
            {isAutoMode ? 'Auto-IPS' : 'Manual Override'}
          </Tag>
        </div>
        
        <div>
          <div style={{ marginBottom: '8px', fontWeight: 'bold', fontSize: '14px', color: '#4b5563' }}>Sampling Time (Auto-IPS Delay):</div>
          <Select 
            value={delay} 
            onChange={handleDelayChange}
            style={{ width: 250 }}
            disabled={!isAutoMode} 
          >
            <Select.Option value={0}>0 seconds (Activate shield immediately)</Select.Option>
            <Select.Option value={10}>10 seconds (Measure system degradation)</Select.Option>
            <Select.Option value={60}>60 seconds (Simulate peak load)</Select.Option>
          </Select>
        </div>
      </div>
    </div>
  );
};

export default ControlPanel;