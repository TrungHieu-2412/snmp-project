// OverviewPage.jsx: Lưới tổng hợp Overview đóng vai trò Layout chính lắp ráp 4 tính năng (Hiệu năng, Tài nguyên, IPS Control và Log).
import { useOutletContext } from 'react-router-dom';
import NetworkPerformance from '../components/NetworkPerformance';
import SystemResources from '../components/SystemResources'; 
import ControlPanel from '../components/ControlPanel';
import EvaluationLogs from '../components/EvaluationLogs';

const OverviewPage = () => {
  const { selectedIp } = useOutletContext();

  // Luôn render 4 component với selectedIp hiện tại.
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '20px' }}>
      <NetworkPerformance selectedIp={selectedIp} />
      <SystemResources selectedIp={selectedIp} />
      <ControlPanel selectedIp={selectedIp} />
      <EvaluationLogs selectedIp={selectedIp} />
    </div>
  );
};

export default OverviewPage;