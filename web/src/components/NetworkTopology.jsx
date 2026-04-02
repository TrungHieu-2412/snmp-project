import React from 'react';
import { Share2 } from 'lucide-react';

const NetworkTopology = () => {
  return (
    <div style={{ padding: '40px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
      <Share2 size={64} color="#9ca3af" style={{ marginBottom: '20px' }} />
      <h2 style={{ fontSize: '24px', color: '#4b5563', marginBottom: '10px' }}>
        Sơ đồ Mạng Nội bộ (Network Topology)
      </h2>
      <p style={{ color: '#6b7280', textAlign: 'center', maxWidth: '500px' }}>
        Tính năng này đang trong quá trình phát triển. Vui lòng quay lại sau để xem cấu trúc và kết nối giữa các VM Agents.
      </p>
    </div>
  );
};

export default NetworkTopology;
