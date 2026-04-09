// BenchmarkPage.jsx: Trang chuyên biệt dùng để chạy test Benchmark độc lập tách rời khỏi Overview.
import { Tabs } from 'antd';
import { Activity, ShieldHalf } from 'lucide-react';
import ProtocolComparison from '../components/ProtocolComparison';
import SecurityAnalyzer from '../components/SecurityAnalyzer';
import { useOutletContext } from 'react-router-dom';

const BenchmarkPage = () => {
  const { selectedIp } = useOutletContext();
  
  const items = [
    {
      key: 'performance',
      label: (
        <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Activity size={16} />
          Performance Test
        </span>
      ),
      children: <ProtocolComparison selectedIp={selectedIp} />,
    },
    {
      key: 'security',
      label: (
        <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ShieldHalf size={16} />
          Security Packet Sniffer
        </span>
      ),
      children: <SecurityAnalyzer selectedIp={selectedIp} />,
    },
  ];

  return (
    <div>
      <Tabs defaultActiveKey="performance" items={items} />
    </div>
  );
};

export default BenchmarkPage;