// OverviewPage.jsx: Lưới tổng hợp Overview đóng vai trò Layout chính lắp ráp 4 tính năng (Hiệu năng, Tài nguyên, IPS Control và Log).
import { useOutletContext } from 'react-router-dom';
import NetworkPerformance from '../components/NetworkPerformance';
import SystemResources from '../components/SystemResources'; 
import ControlPanel from '../components/ControlPanel';
import EvaluationLogs from '../components/EvaluationLogs';

const OverviewPage = () => {
  const { ips, selectedIp } = useOutletContext();

  return (
    <>
      {ips.map(agent => (
        <div 
          key={`overview-grid-${agent.ip}`}
          style={{ 
            display: selectedIp === agent.ip ? 'grid' : 'none', 
            gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', 
            gap: '20px' 
          }}
        >
          <NetworkPerformance selectedIp={agent.ip} />
          <SystemResources selectedIp={agent.ip} />
          <ControlPanel selectedIp={agent.ip} />
          <EvaluationLogs selectedIp={agent.ip} />
        </div>
      ))}
    </>
  );
};

export default OverviewPage;