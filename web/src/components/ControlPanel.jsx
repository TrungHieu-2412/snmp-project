import { useState, useEffect } from 'react';
import { Select, Button, Alert, notification } from 'antd';
import { ShieldAlert, ShieldCheck, Zap } from 'lucide-react';
import { dashboardAPI } from '../lib/api';

const ControlPanel = () => {
  // 1. Quản lý trạng thái hệ thống
  const [delay, setDelay] = useState(10);
  const [currentAlert, setCurrentAlert] = useState(null);
  const [isUnderAttack, setIsUnderAttack] = useState(false);
  const [isMitigating, setIsMitigating] = useState(false);

  // 2. Tự động theo dõi trạng thái từ Backend (Polling mỗi 3 giây)
  useEffect(() => {
    const checkSystemStatus = async () => {
      try {
        // Lấy song song danh sách cảnh báo và nhật ký đánh giá
        const [alerts, logs] = await Promise.all([
          dashboardAPI.getAlerts(),
          dashboardAPI.getEvaluationLogs()
        ]);

        if (alerts && alerts.length > 0) {
          const latestAlert = alerts[alerts.length - 1];
          const latestLog = logs && logs.length > 0 ? logs[logs.length - 1] : null;

          // TH2: Kiểm tra nếu hệ thống đã tự động chặn xong (Log báo "Đã chặn")
          // Hoặc nếu cảnh báo này đã quá cũ (hơn 2 phút)
          const isBlockedInLog = latestLog && latestLog.status === "Đã chặn";
          const isTooOld = Date.now() - parseInt(latestAlert.time) > 120000;

          if (isBlockedInLog || isTooOld) {
            setIsUnderAttack(false); // Nút biến mất, quay về Alert xanh
            return;
          }

          // Nếu có cảnh báo mới và chưa được chặn -> Hiện Alert đỏ và nút bấm
          if (!currentAlert || latestAlert.time !== currentAlert.time) {
            setCurrentAlert(latestAlert);
            setIsUnderAttack(true);
          }
        }
      } catch (error) {
        console.error("Lỗi khi đồng bộ trạng thái IPS:", error);
      }
    };

    const intervalId = setInterval(checkSystemStatus, 3000);
    return () => clearInterval(intervalId);
  }, [currentAlert]);

  // 3. Hàm xử lý đổi độ trễ (IPS Delay)
  const handleDelayChange = async (value) => {
    setDelay(value);
    const success = await dashboardAPI.updateDelayConfig(value);
    if (success) {
      notification.success({ 
        message: 'Cấu hình IPS', 
        description: `Đã thiết lập thời gian chờ phản ứng: ${value} giây.` 
      });
    }
  };

  // 4. TH1: Hàm xử lý khi bấm nút "Chặn Ngay Lập Tức"
  const handleManualMitigation = async () => {
    setIsMitigating(true);
    const ipToBlock = currentAlert ? currentAlert.ip : '10.0.1.2';
    
    // Gửi lệnh SET xuống BE (Lệnh này sẽ gọi triggerManualMitigation để hủy task chờ)
    const success = await dashboardAPI.mitigateAttack(ipToBlock);
    
    if (success) {
      notification.success({ 
        message: 'Can thiệp thủ công', 
        description: `Đã hủy lệnh chờ và kích hoạt chặn IP ${ipToBlock} ngay lập tức!` 
      });
      setIsUnderAttack(false); // Nút biến mất ngay lập tức sau khi có phản hồi thành công
    } else {
      notification.error({ message: 'Lỗi', description: 'Không thể gửi lệnh chặn tới máy chủ.' });
    }
    setIsMitigating(false);
  };

  return (
    <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
      <h2 style={{ fontSize: '18px', marginBottom: '20px', color: '#1f2937', fontWeight: 'bold' }}>
        Hệ thống Phòng thủ Tự động (Auto-IPS Control)
      </h2>

      {/* Khu vực hiển thị Cảnh báo */}
      <div style={{ marginBottom: '24px' }}>
        {isUnderAttack && currentAlert ? (
          <Alert
            message="PHÁT HIỆN TẤN CÔNG: HỆ THỐNG ĐANG TRONG THỜI GIAN CHỜ"
            description={
              <div>
                <p>Nguồn tấn công: <b>{currentAlert.ip}</b> | Loại: {currentAlert.attackType}</p>
                <p>Trạng thái: Đang đếm ngược <b>{delay}s</b> để tự động kích hoạt Iptables...</p>
              </div>
            }
            type="error"
            showIcon
            icon={<ShieldAlert size={28} style={{ marginTop: '12px' }} />}
            action={
              <Button 
                type="primary" 
                danger 
                icon={<Zap size={16} />} 
                onClick={handleManualMitigation}
                loading={isMitigating}
              >
                Chặn Ngay Lập Tức
              </Button>
            }
          />
        ) : (
          <Alert
            message="Hệ thống đang An toàn"
            description="Chế độ Auto-IPS đang giám sát lưu lượng mạng và sẵn sàng phản ứng."
            type="success"
            showIcon
            icon={<ShieldCheck size={28} style={{ marginTop: '12px' }} />}
          />
        )}
      </div>

      {/* Khu vực thiết lập thông số */}
      <div style={{ padding: '20px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
        <div style={{ marginBottom: '10px', fontWeight: '600', fontSize: '14px', color: '#4b5563' }}>
          Thiết lập thời gian chờ phản ứng (IPS Response Delay):
        </div>
        <Select 
          value={delay} 
          onChange={handleDelayChange} 
          style={{ width: '100%' }}
          size="large"
        >
          <Select.Option value={0}>0 giây (Chặn Realtime - Tức thì)</Select.Option>
          <Select.Option value={10}>10 giây (Mặc định - Cân bằng)</Select.Option>
          <Select.Option value={60}>60 giây (Ưu tiên thu thập dữ liệu tải)</Select.Option>
        </Select>
        <p style={{ marginTop: '10px', fontSize: '12px', color: '#94a3b8' }}>
          * Lưu ý: Khi phát hiện tấn công, hệ thống sẽ đợi hết số giây trên mới thực hiện chặn, trừ khi bạn bấm nút can thiệp thủ công.
        </p>
      </div>
    </div>
  );
};

export default ControlPanel;
