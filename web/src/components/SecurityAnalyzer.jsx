// SecurityAnalyzer.jsx: Soi gói tin thô để kiểm chứng tính năng bảo mật (Tương đương Wireshark)
import { useState } from 'react';
import { Button, Tag, Typography, Spin, Row, Col, message } from 'antd';
import { ShieldAlert, ShieldCheck, Play, Shield } from 'lucide-react';
import { dashboardAPI } from '../lib/api';

const { Text } = Typography;

const PROTOCOLS = [
  { id: 'v1', name: 'SNMPv1', desc: 'GET / Plaintext', icon: <ShieldAlert size={16} />, color: '#f87171' },
  { id: 'v2c', name: 'SNMPv2c', desc: 'GET / Plaintext', icon: <Shield size={16} />, color: '#34d399' },
  { id: 'v3', name: 'SNMPv3', desc: 'GET / AES Encrypted', icon: <ShieldCheck size={16} />, color: '#60a5fa' }
];

const SecurityAnalyzer = ({ selectedIp }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleCapture = async () => {
    if (!selectedIp) return;
    setLoading(true);
    const result = await dashboardAPI.runSecurityDemo(selectedIp);
    if (result && result.error) {
      message.error(result.error, 5); // Warning 5 giây
      setData(null);
    } else {
      setData(result);
    }
    setLoading(false);
  };

  // Helper để highlight chữ "public" và nội dung OID hệ điều hành (ví dụ: Linux)
  const renderAsciiWithHighlight = (asciiStr, protocol) => {
    if (!asciiStr) return null;
    
    // Nếu là v3, mọi thứ đều đã được mã hóa nên không cần highlight
    if (protocol === 'v3') {
      return <span>{asciiStr}</span>;
    }
    
    let highlighted = asciiStr;
    const parts = [];
    
    // Tìm và bôi đỏ chuỗi "public"
    let idx = highlighted.indexOf('public');
    if (idx !== -1) {
      parts.push(<span key="1">{highlighted.substring(0, idx)}</span>);
      parts.push(<span key="2" style={{ backgroundColor: '#fee2e2', color: '#ef4444', fontWeight: 'bold', padding: '0 2px', borderRadius: '2px' }}>public</span>);
      highlighted = highlighted.substring(idx + 6);
    }
    
    // Tìm và bôi vàng OID response "Linux" (tương đối)
    let idxLinux = highlighted.indexOf('Linux');
    if (idxLinux !== -1) {
      parts.push(<span key="3">{highlighted.substring(0, idxLinux)}</span>);
      parts.push(<span key="4" style={{ backgroundColor: '#fef3c7', color: '#d97706', fontWeight: 'bold', padding: '0 2px', borderRadius: '2px' }}>Linux</span>);
      highlighted = highlighted.substring(idxLinux + 5);
    }
    
    parts.push(<span key="5">{highlighted}</span>);
    return parts;
  };

  return (
    <div style={{ backgroundColor: 'white', padding: '24px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
        <div>
          <h2 style={{ fontSize: '18px', color: '#1f2937', margin: 0 }}>
            Security Packet Sniffer — Agent: {selectedIp || 'Not selected'}
          </h2>
          <p style={{ color: '#6b7280', fontSize: '13px', margin: '5px 0 0 0' }}>
            Captures and analyzes raw UDP Response packets (like Wireshark). Requesting sysDescr (OS info) OID.
          </p>
        </div>
        <Button
          type="primary"
          icon={<Play size={16} />}
          onClick={handleCapture}
          loading={loading}
          size="large"
          style={{ backgroundColor: '#0f172a', flexShrink: 0 }}
        >
          {loading ? 'Sniffing...' : 'Capture Packets'}
        </Button>
      </div>

      {!data && (
        <div style={{ height: '180px', display: 'flex', justifyContent: 'center', alignItems: 'center', border: '1px dashed #d1d5db', borderRadius: '8px' }}>
          <span style={{ color: '#9ca3af' }}>Click "Capture Packets" to extract payload from network...</span>
        </div>
      )}

      {data && (
        <Row gutter={[24, 24]}>
          {PROTOCOLS.map((proto) => (
            <Col span={8} key={proto.id}>
              <div style={{ border: `1px solid ${proto.color}40`, borderRadius: '8px', overflow: 'hidden' }}>
                <div style={{ backgroundColor: `${proto.color}15`, padding: '12px 16px', borderBottom: `1px solid ${proto.color}40`, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: proto.color, fontWeight: 'bold' }}>
                    {proto.icon}
                    {proto.name}
                  </div>
                  <Tag bordered={false} style={{ margin: 0 }}>{proto.desc}</Tag>
                </div>
                
                <div style={{ padding: '16px', backgroundColor: '#ffffff', minHeight: '300px' }}>
                  {data[proto.id] ? (
                    <>
                      <div style={{ marginBottom: '16px' }}>
                        <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#6b7280', marginBottom: '4px', textTransform: 'uppercase' }}>
                          Raw Hex Dump
                        </div>
                        <div style={{ fontFamily: '"Fira Code", monospace', fontSize: '11px', color: '#374151', wordBreak: 'break-all', backgroundColor: '#f8fafc', padding: '12px', borderRadius: '6px', border: '1px solid #e2e8f0', lineHeight: '1.6' }}>
                          {data[proto.id].hex}
                        </div>
                      </div>
                      
                      <div>
                        <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#6b7280', marginBottom: '4px', textTransform: 'uppercase' }}>
                          ASCII Decode
                        </div>
                        <div style={{ fontFamily: '"Fira Code", monospace', fontSize: '12px', color: '#374151', wordBreak: 'break-all', backgroundColor: '#f8fafc', padding: '12px', borderRadius: '6px', border: '1px solid #e2e8f0', whiteSpace: 'pre-wrap', lineHeight: '1.6' }}>
                          {renderAsciiWithHighlight(data[proto.id].ascii, proto.id)}
                        </div>
                      </div>
                      
                      {proto.id === 'v3' && (
                         <div style={{ marginTop: '12px', textAlign: 'center', color: '#10b981', fontSize: '12px', fontWeight: 'bold' }}>
                           ✓ Payload fully encrypted. No readable 'public' or 'Linux' OS info leaked.
                         </div>
                      )}
                      {proto.id !== 'v3' && (
                         <div style={{ marginTop: '12px', textAlign: 'center', color: '#ef4444', fontSize: '12px', fontWeight: 'bold' }}>
                           ⚠ CRITICAL: Community key and OS data transmitted in Plaintext.
                         </div>
                      )}
                    </>
                  ) : (
                     <div style={{ textAlign: 'center', color: '#9ca3af', marginTop: '50px' }}>No packet captured</div>
                  )}
                </div>
              </div>
            </Col>
          ))}
        </Row>
      )}
    </div>
  );
};

export default SecurityAnalyzer;
