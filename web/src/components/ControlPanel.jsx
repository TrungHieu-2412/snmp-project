// ControlPanel.jsx: Khối tổng hợp trạng thái An ninh mạng, hiển thị ngay hộp cảnh báo Đỏ (nếu có tấn công) và các công tắc điều chỉnh chế độ chặn Iptables.
import { useState, useEffect } from 'react';
import { Switch, Select, Button, Alert, Tag, notification } from 'antd';
import { ShieldAlert, ShieldCheck, Zap, Lock } from 'lucide-react';
import { dashboardAPI } from '../lib/api';

const ControlPanel = ({ selectedIp }) => {
  const [isSupported, setIsSupported] = useState(true);
  const [isAutoMode, setIsAutoMode] = useState(true); 
  const [delay, setDelay] = useState(10);
  
  const [currentAlert, setCurrentAlert] = useState(null);
  const [isUnderAttack, setIsUnderAttack] = useState(false);

  // Kiểm tra xem máy Agent này có hỗ trợ IPS không
  useEffect(() => {
    const checkSupport = async () => {
      if (selectedIp) {
        const supported = await dashboardAPI.checkIpsSupport(selectedIp);
        setIsSupported(supported);
      }
    };
    checkSupport();
  }, [selectedIp])

  // Lấy dữ liệu cảnh báo tấn công nhận từ API
  useEffect(() => {
    if (!isSupported) return;
    const fetchAlerts = async () => {
      // Lấy danh sách cảnh báo từ API
      const alerts = await dashboardAPI.getAlerts();
      if (alerts && alerts.length > 0) {
        const latestAlert = alerts[alerts.length - 1];
        
        // Chỉ xử lý cảnh báo của máy Agent đang được chọn
        if (latestAlert.ip !== selectedIp) return;

        // Kiểm tra xem có cảnh báo mới không và cập nhật nếu có
        if (!currentAlert || latestAlert.time !== currentAlert.time) {
          setCurrentAlert(latestAlert);
          
          // Cập nhật trạng thái tấn công
          if (latestAlert.status === 'Resolved') {
            setIsUnderAttack(false);
          } else {
            setIsUnderAttack(true);
          }
        }
        // Nếu không có thì hiển thị trạng thái an toàn
        else if (latestAlert.status === 'Resolved' && isUnderAttack) {
          setIsUnderAttack(false);
          notification.success({ message: 'Auto-Defense', description: 'System successfully activated IPS shield!' });
        }
      }
    };
    // Lấy dữ liệu cảnh báo tấn công mỗi 5 giây
    const intervalId = setInterval(fetchAlerts, 3000);
    return () => clearInterval(intervalId);
  }, [currentAlert, isUnderAttack, isSupported, selectedIp]);

  // Xử lý logic thay đổi thời gian tự động kích hoạt IPS
  const handleDelayChange = async (value) => {
    setDelay(value);
    const success = await dashboardAPI.updateDelayConfig(value);
    if (success) {
      notification.success({ message: 'Success', description: `System updated: Delay ${value}s` });
    } else {
      notification.error({ message: 'Error', description: 'Cannot update configuration to NMS server.' });
    }
  };

  // Xử lý logic thay đổi chế độ Auto-IPS
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

  // Xử lý logic chặn thủ công
  const handleManualMitigation = async () => {
    const ipToBlock = currentAlert ? currentAlert.ip : selectedIp;
    const success = await dashboardAPI.mitigateAttack(ipToBlock);
    
    if (success) {
      notification.success({ message: 'Defense Successful', description: `Successfully deployed Iptables shield blocking IP ${ipToBlock}!` });
      setIsUnderAttack(false);
    } else {
      notification.error({ message: 'Error', description: 'Failed to send SET command!' });
    }
  };

  if (!isSupported) {
    return (
      <div style={{ backgroundColor: '#f9fafb', padding: '40px 20px', borderRadius: '8px', border: '1px dashed #d1d5db', textAlign: 'center', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <Lock size={48} color="#9ca3af" style={{ margin: '0 auto 15px' }} />
        <h3 style={{ color: '#4b5563', marginBottom: '10px' }}>Control and Warning Panel - Not Available</h3>
        <p style={{ color: '#6b7280' }}>The IPS and Trap features are currently only available on the <b>10.0.1.2 (VM1)</b> agent.</p>
      </div>
    );
  }

  return (
    <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2 style={{ fontSize: '18px', color: '#1f2937', margin: 0 }}>Control and Warning Panel</h2>
        <Tag color="blue">Supported Node</Tag>
      </div>

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
            <Select.Option value={0}>0 seconds</Select.Option>
            <Select.Option value={10}>10 seconds</Select.Option>
            <Select.Option value={60}>60 seconds</Select.Option>
          </Select>
        </div>
      </div>
    </div>
  );
};

export default ControlPanel;