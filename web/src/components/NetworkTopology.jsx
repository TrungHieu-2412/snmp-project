// NetworkTopology.jsx: Một Placeholder rỗng đại diện cho Sơ đồ Mạng nội bộ trong tương lai.
import { Share2 } from 'lucide-react';

const NetworkTopology = () => {
  return (
    <div style={{ padding: '40px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
      <Share2 size={64} color="#9ca3af" style={{ marginBottom: '20px' }} />
      <h2 style={{ fontSize: '24px', color: '#4b5563', marginBottom: '10px' }}>
        Internal Network Topology
      </h2>
      <p style={{ color: '#6b7280', textAlign: 'center', maxWidth: '500px' }}>
        This feature is under development. Please check back later to view the structure and connections between VM Agents.
      </p>
    </div>
  );
};

export default NetworkTopology;