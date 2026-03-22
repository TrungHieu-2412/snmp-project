import React, { useState } from 'react';
import { Switch, Select, Button, Alert, Tag } from 'antd';
import { ShieldAlert, ShieldCheck, RefreshCw, Zap } from 'lucide-react';

const ControlPanel = () => {
  // Quản lý trạng thái các công tắc và cấu hình
  const [isAutoMode, setIsAutoMode] = useState(true);
  const [delay, setDelay] = useState(10);
  
  // Biến giả lập trạng thái đang bị tấn công (để hiển thị UI cho bạn xem trước)
  const [isUnderAttack, setIsUnderAttack] = useState(true);

  return (
    <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
      <h2 style={{ fontSize: '18px', marginBottom: '20px', color: '#1f2937' }}>
        Điều khiển và cảnh báo (control and warning)
      </h2>

      {/* --- PHẦN 1: CẢNH BÁO THỜI GIAN THỰC --- */}
      <div style={{ marginBottom: '20px' }}>
        {isUnderAttack ? (
          <Alert
            message="CẢNH BÁO BẢO MẬT NGHIÊM TRỌNG"
            description="Phát hiện luồng tấn công TCP SYN Flood! Đồng hồ kết nối vượt ngưỡng."
            type="error"
            showIcon
            icon={<ShieldAlert size={24} style={{ marginTop: '8px' }} />}
            action={
              <Button size="small" danger onClick={() => setIsUnderAttack(false)}>
                Giả lập: Tắt cảnh báo
              </Button>
            }
          />
        ) : (
          <Alert
            message="Hệ thống đang an toàn"
            description="Chưa phát hiện lưu lượng mạng bất thường."
            type="success"
            showIcon
            icon={<ShieldCheck size={24} style={{ marginTop: '8px' }} />}
            action={
              <Button size="small" type="primary" onClick={() => setIsUnderAttack(true)}>
                Giả lập: Nhận TRAP
              </Button>
            }
          />
        )}
      </div>

      {/* --- PHẦN 2: CÀI ĐẶT KỊCH BẢN (ĐỘ TRỄ) --- */}
      <div style={{ display: 'flex', gap: '30px', marginBottom: '20px', padding: '15px', backgroundColor: '#f8fafc', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
        <div>
          <div style={{ marginBottom: '8px', fontWeight: 'bold', fontSize: '14px', color: '#4b5563' }}>Chế độ hoạt động:</div>
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
          <div style={{ marginBottom: '8px', fontWeight: 'bold', fontSize: '14px', color: '#4b5563' }}>Bộ giả lập độ trễ (Delay):</div>
          <Select 
            value={delay} 
            onChange={setDelay} 
            style={{ width: 200 }}
            disabled={!isAutoMode} // Chỉ cho phép chọn độ trễ khi ở chế độ Tự động
          >
            <Select.Option value={0}>0 giây (Phản ứng tức thời)</Select.Option>
            <Select.Option value={10}>10 giây (Đo lường suy thoái)</Select.Option>
            <Select.Option value={30}>30 giây (Tìm điểm chết)</Select.Option>
          </Select>
        </div>
      </div>

      {/* --- PHẦN 3: NÚT BẤM CAN THIỆP THỦ CÔNG --- */}
      <div style={{ marginBottom: '10px', fontWeight: 'bold', fontSize: '14px', color: '#4b5563' }}>
        Can thiệp thủ công (Action Buttons):
      </div>
      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        {/* Các nút này sẽ bị mờ đi (disabled) nếu đang bật chế độ Tự động */}
        <Button type="primary" danger icon={<Zap size={16} />} disabled={isAutoMode}>
          Chặn SYN
        </Button>
        <Button type="primary" danger icon={<Zap size={16} />} disabled={isAutoMode}>
          Chặn UDP
        </Button>
        <Button type="primary" danger icon={<Zap size={16} />} disabled={isAutoMode}>
          Chặn ACK
        </Button>
        
        <div style={{ flex: 1 }}></div> {/* Lực đẩy để đẩy nút Reset sang sát mép phải */}
        
        <Button 
          icon={<RefreshCw size={16} />}
          onClick={() => alert("Đã gửi lệnh SET gọi script clear_iptables.sh để dọn dẹp Firewall!")}
        >
          Reset Firewall
        </Button>
      </div>
    </div>
  );
};

export default ControlPanel;