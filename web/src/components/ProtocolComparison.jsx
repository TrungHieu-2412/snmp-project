// ProtocolComparison.jsx: Vẽ Summary Table + biểu đồ Benchmark so sánh SNMPv1, v2c và v3.
import { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';
import { Button, Spin, Tag, Table, Divider, message } from 'antd';
import { Play, ShieldCheck, ShieldAlert, Shield } from 'lucide-react';
import { dashboardAPI } from '../lib/api';

// Màu sắc và badge bảo mật cho từng protocol
const PROTOCOL_CONFIG = {
  'SNMPv1':  { color: '#f87171', secTag: { color: 'error',   icon: <ShieldAlert size={12} />, label: 'No Security'       } },
  'SNMPv2c': { color: '#34d399', secTag: { color: 'warning', icon: <Shield size={12} />,      label: 'Community String'  } },
  'SNMPv3':  { color: '#60a5fa', secTag: { color: 'success', icon: <ShieldCheck size={12} />, label: 'Auth + Encryption' } },
};

// Các cột của bảng summary
const summaryColumns = [
  {
    title: 'Protocol',
    dataIndex: 'protocol',
    key: 'protocol',
    render: (text) => <strong style={{ color: PROTOCOL_CONFIG[text]?.color }}>{text}</strong>,
  },
  {
    title: 'PDU Method',
    dataIndex: 'pduType',
    key: 'pduType',
    render: (text) => <code style={{ background: '#f3f4f6', padding: '2px 6px', borderRadius: 4 }}>{text}</code>,
  },
  {
    title: 'Security Level',
    dataIndex: 'securityLevel',
    key: 'securityLevel',
    render: (text, record) => {
      const cfg = PROTOCOL_CONFIG[record.protocol]?.secTag;
      return (
        <Tag color={cfg?.color} icon={cfg?.icon} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
          {cfg?.label}
        </Tag>
      );
    },
  },
  {
    title: 'Latency (ms)',
    dataIndex: 'timeMs',
    key: 'timeMs',
    render: (v) => <span style={{ fontWeight: 'bold' }}>{v} ms</span>,
  },
  {
    title: 'OIDs Retrieved',
    dataIndex: 'oidsRetrieved',
    key: 'oidsRetrieved',
    render: (v) => `${v} OIDs`,
  },
  {
    title: 'Throughput',
    dataIndex: 'oidThroughput',
    key: 'oidThroughput',
    render: (v) => <span style={{ color: '#4f46e5', fontWeight: 'bold' }}>{v} OIDs/s</span>,
  },
  {
    title: 'UDP Packets',
    dataIndex: 'requests',
    key: 'requests',
    render: (v) => `${v} packet(s)`,
  },
];

// Component chính để so sánh hiệu suất SNMPv1, v2c và v3
const ProtocolComparison = ({ selectedIp }) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);

  // Hàm gọi API để chạy benchmark
  const handleRunBenchmark = async () => {
    if (!selectedIp) return;
    setLoading(true);
    const result = await dashboardAPI.runProtocolBenchmark(selectedIp);
    if (result && result.error) {
      message.error(result.error, 5);
    } else {
      setData(result);
    }
    setLoading(false);
  };

  return (
    <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', gridColumn: 'span 2' }}>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
        <div>
          <h2 style={{ fontSize: '18px', color: '#1f2937', margin: 0 }}>
            SNMP Protocol Performance Comparison - Agent: {selectedIp || 'Not selected'}
          </h2>
          <p style={{ color: '#6b7280', fontSize: '13px', margin: '3px 0 0 0' }}>
            Fetches 50 consecutive OIDs from the Agent using each protocol. Measures latency, throughput, security overhead.
          </p>
        </div>
        <Button
          type="primary"
          icon={<Play size={16} />}
          onClick={handleRunBenchmark}
          loading={loading}
          size="large"
          style={{ backgroundColor: '#4f46e5', flexShrink: 0 }}
        >
          {loading ? 'Measuring network...' : 'Run Benchmark'}
        </Button>
      </div>

      {/* Empty state */}
      {data.length === 0 && (
        <div style={{ height: '180px', display: 'flex', justifyContent: 'center', alignItems: 'center', border: '1px dashed #d1d5db', borderRadius: '8px' }}>
          <span style={{ color: '#9ca3af' }}>Click "Run Benchmark" to start the real network test...</span>
        </div>
      )}

      {/* Results */}
      {data.length > 0 && (
        <>
          {/* Summary Table */}
          <Divider orientation="left" style={{ color: '#4b5563', fontWeight: 600 }}>Summary</Divider>
          <Table
            columns={summaryColumns}
            dataSource={data.map((d) => ({ ...d, key: d.protocol }))}
            pagination={false}
            size="middle"
            style={{ marginBottom: '32px' }}
          />

          {/* Charts */}
          <Divider orientation="left" style={{ color: '#4b5563', fontWeight: 600 }}>Charts</Divider>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '40px', marginTop: '8px' }}>

            {/* Chart 1: Latency */}
            <div>
              <h3 style={{ textAlign: 'center', fontSize: '15px', color: '#4b5563', marginBottom: '12px' }}>
                Response Time (ms) - Lower is better
              </h3>
              <div style={{ height: '280px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="protocol" />
                    <YAxis unit=" ms" />
                    <Tooltip formatter={(v) => [`${v} ms`, 'Latency']} cursor={{ fill: '#f3f4f6' }} />
                    <Bar dataKey="timeMs" name="Latency (ms)" radius={[4, 4, 0, 0]}>
                      {data.map((entry, index) => (
                        <Cell key={`cell-lat-${index}`} fill={PROTOCOL_CONFIG[entry.protocol]?.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <p style={{ textAlign: 'center', fontSize: '12px', color: '#6b7280', marginTop: '8px' }}>
                * SNMPv1 is slowest (50 sequential round-trips). SNMPv3 adds AES+SHA overhead vs v2c.
              </p>
            </div>

            {/* Chart 2: Throughput */}
            <div>
              <h3 style={{ textAlign: 'center', fontSize: '15px', color: '#4b5563', marginBottom: '12px' }}>
                Throughput (OIDs/s) - Higher is better
              </h3>
              <div style={{ height: '280px' }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="protocol" />
                    <YAxis unit=" /s" />
                    <Tooltip formatter={(v) => [`${v} OIDs/s`, 'Throughput']} cursor={{ fill: '#f3f4f6' }} />
                    <Bar dataKey="oidThroughput" name="Throughput (OIDs/s)" radius={[4, 4, 0, 0]}>
                      {data.map((entry, index) => (
                        <Cell key={`cell-tp-${index}`} fill={PROTOCOL_CONFIG[entry.protocol]?.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <p style={{ textAlign: 'center', fontSize: '12px', color: '#6b7280', marginTop: '8px' }}>
                * v2c achieves highest throughput (GETBULK, no crypto). v3 trades speed for security.
              </p>
            </div>

          </div>

          {/* Key Insights */}
          <Divider orientation="left" style={{ color: '#4b5563', fontWeight: 600, marginTop: '28px' }}>Key Insights</Divider>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
            {[
              { proto: 'SNMPv1', bg: '#fef2f2', border: '#fca5a5', points: ['No GETBULK support -> 50 round-trips per query', 'Community string sent in plaintext', 'Highest latency, lowest throughput', 'Legacy protocol - avoid in new deployments'] },
              { proto: 'SNMPv2c', bg: '#f0fdf4', border: '#86efac', points: ['GETBULK: retrieves up to 50 OIDs in 1 UDP packet', 'Community string sent in plaintext (no encryption)', 'Best raw throughput of all 3 versions', 'Recommended for internal/trusted networks'] },
              { proto: 'SNMPv3', bg: '#eff6ff', border: '#93c5fd', points: ['GETBULK + SHA-1 Auth + AES-128 Encryption', 'Crypto overhead adds latency vs v2c', 'Highest security - prevents spoofing & eavesdropping', 'Required for production/external networks'] },
            ].map(({ proto, bg, border, points }) => (
              <div key={proto} style={{ background: bg, border: `1px solid ${border}`, borderRadius: 8, padding: '16px' }}>
                <div style={{ fontWeight: 700, fontSize: '15px', color: PROTOCOL_CONFIG[proto]?.color, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                  {PROTOCOL_CONFIG[proto]?.secTag?.icon} {proto}
                </div>
                <ul style={{ margin: 0, paddingLeft: '16px', fontSize: '12px', color: '#374151', lineHeight: '1.8' }}>
                  {points.map((p, i) => <li key={i}>{p}</li>)}
                </ul>
              </div>
            ))}
          </div>

        </>
      )}
    </div>
  );
};

export default ProtocolComparison;