import { useState, useEffect } from 'react';
import { Switch, Select, Button, Alert, Tag, notification } from 'antd';
import { ShieldAlert, ShieldCheck, RefreshCw, Zap } from 'lucide-react';
import { dashboardAPI } from '../lib/api';

const ControlPanel = () => {
  // Quản lý trạng thái các công tắc và cấu hình
  const [isAutoMode, setIsAutoMode] = useState(true);
  const [delay, setDelay] = useState(10);
  
  // State lưu trữ Cảnh báo thực tế từ BE
  const [currentAlert, setCurrentAlert] = useState(null);
  const [isUnderAttack, setIsUnderAttack] = useState(false);

  // Fetch cảnh báo từ BE mỗi 5 giây
  useEffect(() => {
    const fetchAlerts = async () => {
      const alerts = await dashboardAPI.getAlerts();
      if (alerts && alerts.length > 0) {
        const latestAlert = alerts[alerts.length - 1];
        
        // Nếu có cảnh báo mới (khác thời gian với cảnh báo cũ đang lưu), ta bung Alert đỏ lên
        if (!currentAlert || latestAlert.time !== currentAlert.time) {
          setCurrentAlert(latestAlert);
          setIsUnderAttack(true);
        }
      }
    };
    const intervalId = setInterval(fetchAlerts, 5000);
    return () => clearInterval(intervalId);
  }, [currentAlert]);
  
  // Hàm xử lý khi người dùng đổi độ trễ
  const handleDelayChange = async (value) => {
    setDelay(value);
    // GỌI API POST XUỐNG BE
    const success = await dashboardAPI.updateDelayConfig(value);
    if (success) {
      notification.success({ message: 'Thành công', description: `Đã cập nhật hệ thống: Độ trễ ${value}s` });
    } else {
      notification.error({ message: 'Lỗi', description: 'Không thể cập nhật cấu hình tới máy chủ NMS.' });
    }
  };

  // Hàm xử lý khi bấm nút "Chặn Thủ Công" trên Alert
  const handleManualMitigation = async () => {
    const ipToBlock = currentAlert ? currentAlert.ip : '10.0.1.2';
    const success = await dashboardAPI.mitigateAttack(ipToBlock);
    
    if (success) {
      notification.success({ message: 'Phòng thủ thành công', description: `Đã dựng khiên Iptables chặn IP ${ipToBlock}!` });
      setIsUnderAttack(false);
    } else {
      notification.error({ message: 'Lỗi', description: 'Gửi lệnh SET thất bại!' });
    }
  };

  return (
    <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
      <h2 style={{ fontSize: '18px', marginBottom: '20px', color: '#1f2937' }}>
        Điều khiển và cảnh báo (Control and Warning)
      </h2>

      <div style={{ marginBottom: '20px' }}>
        {isUnderAttack && currentAlert ? (
          <Alert
            message={`CẢNH BÁO: PHÁT HIỆN TẤN CÔNG ${currentAlert.attackType.toUpperCase()}!`}
            description={`Mục tiêu: ${currentAlert.ip} | Thời gian: ${new Date(parseInt(currentAlert.time)).toLocaleTimeString('vi-VN')} | Thông điệp: ${currentAlert.message}`}
            type="error"
            showIcon
            icon={<ShieldAlert size={24} style={{ marginTop: '8px' }} />}
            action={
              <Button type="primary" danger icon={<Zap size={16} />} onClick={handleManualMitigation}>
                Can thiệp Chặn Ngay
              </Button>
            }
          />
        ) : (
          <Alert
            message="Hệ thống đang hoạt động an toàn"
            description="Chưa phát hiện lưu lượng mạng bất thường từ các tác nhân bên ngoài."
            type="success"
            showIcon
            icon={<ShieldCheck size={24} style={{ marginTop: '8px' }} />}
          />
        )}
      </div>

      <div style={{ display: 'flex', gap: '30px', padding: '15px', backgroundColor: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
        <div>
          <div style={{ marginBottom: '8px', fontWeight: 'bold', fontSize: '14px', color: '#4b5563' }}>Chế độ phòng thủ:</div>
          <Switch 
            checked={isAutoMode} 
            onChange={(checked) => setIsAutoMode(checked)} 
            checkedChildren="TỰ ĐỘNG" 
            unCheckedChildren="THỦ CÔNG"
          />
          <Tag color={isAutoMode ? 'green' : 'orange'} style={{ marginLeft: '10px' }}>
            {isAutoMode ? 'Auto-IPS' : 'Manual Override'}
          </Tag>
        </div>
        
        <div>
          <div style={{ marginBottom: '8px', fontWeight: 'bold', fontSize: '14px', color: '#4b5563' }}>Thời gian lấy mẫu (Delay Auto-IPS):</div>
          <Select 
            value={delay} 
            onChange={handleDelayChange}
            style={{ width: 250 }}
            disabled={!isAutoMode} 
          >
            <Select.Option value={0}>0 giây (Kích hoạt khiên ngay lập tức)</Select.Option>
            <Select.Option value={10}>10 giây (Đo lường mức độ suy thoái hệ thống)</Select.Option>
            <Select.Option value={60}>60 giây (Giả lập hệ thống đạt đỉnh tải)</Select.Option>
          </Select>
        </div>
      </div>
    </div>
  );
};

export default ControlPanel;