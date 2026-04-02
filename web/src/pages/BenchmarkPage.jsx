// BenchmarkPage.jsx: Trang chuyên biệt dùng để chạy test Benchmark độc lập tách rời khỏi Overview.
import ProtocolComparison from '../components/ProtocolComparison';
import { useOutletContext } from 'react-router-dom';

const BenchmarkPage = () => {
  const { selectedIp } = useOutletContext();
  
  return (
    <div>
      <ProtocolComparison selectedIp={selectedIp} />
    </div>
  );
};

export default BenchmarkPage;
