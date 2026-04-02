// ProtocolComparison.jsx: Vẽ 2 biểu đồ cột chạy Benchmark đọ sức độ trễ giữa SNMP v1, v2c và v3 trên cùng 1 Agent.
import { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';
import { Button, Spin } from 'antd';
import { Play } from 'lucide-react';
import { dashboardAPI } from '../lib/api';

const ProtocolComparison = ({ selectedIp }) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);

  const handleRunBenchmark = async () => {
    if (!selectedIp) return;
    setLoading(true);
    const result = await dashboardAPI.runProtocolBenchmark(selectedIp);
    setData(result);
    setLoading(false);
  };

  const colors = ['#f87171', '#34d399', '#60a5fa']; 

  return (
    <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', gridColumn: 'span 2' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h2 style={{ fontSize: '18px', color: '#1f2937', margin: 0 }}>
            Scenario Analysis: SNMP Protocol Performance Comparison on {selectedIp || 'Not selected'}
          </h2>
          <p style={{ color: '#6b7280', fontSize: '13px', margin: '5px 0 0 0' }}>
            The test requires fetching 50 consecutive parameters from the selected Agent. Measuring Latency and Requests.
          </p>
        </div>
        
        <Button 
          type="primary" 
          icon={<Play size={16} />} 
          onClick={handleRunBenchmark}
          loading={loading}
          size="large"
          style={{ backgroundColor: '#4f46e5' }}
        >
          {loading ? 'Measuring network...' : 'Run Benchmark'}
        </Button>
      </div>

      {data.length > 0 ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '40px', marginTop: '30px' }}>
          
          <div>
            <h3 style={{ textAlign: 'center', fontSize: '15px', color: '#4b5563' }}>
              ⏱️ Response Time (Milliseconds) - Lower is better
            </h3>
            <div style={{ height: '300px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="protocol" />
                  <YAxis />
                  <Tooltip cursor={{fill: '#f3f4f6'}} />
                  <Bar dataKey="timeMs" name="Latency (ms)" radius={[4, 4, 0, 0]}>
                    {data.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={colors[index % 20]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p style={{ textAlign: 'center', fontSize: '12px', color: '#6b7280', marginTop: '10px' }}>
              *SNMPv1 is slowest due to waiting for sequential responses. SNMPv3 is slower than v2c due to AES decryption overhead.
            </p>
          </div>

          <div>
            <h3 style={{ textAlign: 'center', fontSize: '15px', color: '#4b5563' }}>
              Network Packets (Requests) - Lower is better
            </h3>
            <div style={{ height: '300px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="protocol" />
                  <YAxis />
                  <Tooltip cursor={{fill: '#f3f4f6'}} />
                  <Bar dataKey="requests" name="GET Requests" radius={[4, 4, 0, 0]}>
                    {data.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={colors[index % 20]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p style={{ textAlign: 'center', fontSize: '12px', color: '#6b7280', marginTop: '10px' }}>
              *SNMPv1 uses GETNEXT (50 turns). SNMPv2c/v3 uses GETBULK (grouped into 1 response).
            </p>
          </div>

        </div>
      ) : (
        <div style={{ height: '200px', display: 'flex', justifyContent: 'center', alignItems: 'center', border: '1px dashed #d1d5db', borderRadius: '8px' }}>
          <span style={{ color: '#9ca3af' }}>Please click "Run Benchmark" to start the real network test...</span>
        </div>
      )}
    </div>
  );
};

export default ProtocolComparison;