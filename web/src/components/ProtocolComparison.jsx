import React, { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';
import { Button, Spin } from 'antd';
import { Play } from 'lucide-react';
import { dashboardAPI } from '../lib/api';

const ProtocolComparison = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);

  const handleRunBenchmark = async () => {
    setLoading(true);
    // Gọi API chạy test thực tế trên BE
    const result = await dashboardAPI.runProtocolBenchmark();
    setData(result);
    setLoading(false);
  };

  // Màu sắc cho các cột
  const colors = ['#f87171', '#34d399', '#60a5fa']; 

  return (
    <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)', gridColumn: 'span 2' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h2 style={{ fontSize: '18px', color: '#1f2937', margin: 0 }}>
            Phân tích Kịch bản: So sánh Hiệu năng Giao thức SNMP (v1 vs v2c vs v3)
          </h2>
          <p style={{ color: '#6b7280', fontSize: '13px', margin: '5px 0 0 0' }}>
            Bài test yêu cầu lấy 50 thông số liên tiếp từ Agent (VM1). Đo lường Độ trễ (Latency) và Số lượng gói tin (Requests).
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
          {loading ? 'Đang đo lường mạng...' : 'Chạy Benchmark'}
        </Button>
      </div>

      {data.length > 0 ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '40px', marginTop: '30px' }}>
          
          {/* Biểu đồ 1: Thời gian thực thi (Càng thấp càng tốt) */}
          <div>
            <h3 style={{ textAlign: 'center', fontSize: '15px', color: '#4b5563' }}>
              ⏱️ Thời gian phản hồi (Milliseconds) - Càng thấp càng tốt
            </h3>
            <div style={{ height: '300px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="protocol" />
                  <YAxis />
                  <Tooltip cursor={{fill: '#f3f4f6'}} />
                  <Bar dataKey="timeMs" name="Độ trễ (ms)" radius={[4, 4, 0, 0]}>
                    {data.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={colors[index % 20]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p style={{ textAlign: 'center', fontSize: '12px', color: '#6b7280', marginTop: '10px' }}>
              *SNMPv1 chậm nhất do phải chờ phản hồi liên tục. SNMPv3 chậm hơn v2c do tốn thời gian giải mã AES.
            </p>
          </div>

          {/* Biểu đồ 2: Số lượng Gói tin mạng (Càng thấp càng tốt) */}
          <div>
            <h3 style={{ textAlign: 'center', fontSize: '15px', color: '#4b5563' }}>
              Số lượng Gói tin mạng (Requests) - Càng ít càng tiết kiệm
            </h3>
            <div style={{ height: '300px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="protocol" />
                  <YAxis />
                  <Tooltip cursor={{fill: '#f3f4f6'}} />
                  <Bar dataKey="requests" name="Số gói tin GET" radius={[4, 4, 0, 0]}>
                    {data.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={colors[index % 20]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p style={{ textAlign: 'center', fontSize: '12px', color: '#6b7280', marginTop: '10px' }}>
              *SNMPv1 dùng GETNEXT (50 lượt). SNMPv2c/v3 dùng GETBULK (gom vào 1 túi).
            </p>
          </div>

        </div>
      ) : (
        <div style={{ height: '200px', display: 'flex', justifyContent: 'center', alignItems: 'center', border: '1px dashed #d1d5db', borderRadius: '8px' }}>
          <span style={{ color: '#9ca3af' }}>Vui lòng bấm "Chạy Benchmark" để bắt đầu test mạng thực tế...</span>
        </div>
      )}
    </div>
  );
};

export default ProtocolComparison;