import React, { useState, useEffect } from 'react';
import { Table, Button, Tag } from 'antd';
import { Download } from 'lucide-react';
import { dashboardAPI } from '../lib/api';

// Định nghĩa các cột hiển thị trên Web
const columns = [
  { title: 'Bắt đầu', dataIndex: 'startTime', key: 'startTime', width: 80 },
  { title: 'Kết thúc', dataIndex: 'endTime', key: 'endTime', width: 80 },
  { 
    title: 'Kịch bản tấn công', 
    dataIndex: 'attackType', 
    key: 'attackType',
    width: 140,
    render: (text) => <span style={{ fontWeight: 'bold' }}>{text}</span>
  },
  { title: 'Băng thông', dataIndex: 'minBandwidth', key: 'minBandwidth', width: 100, align: 'center' },
  { title: 'PPS', dataIndex: 'maxPps', key: 'maxPps', width: 80, align: 'center' },
  { title: 'CPU', dataIndex: 'maxCpu', key: 'maxCpu', width: 70, align: 'center' },
  { title: 'RAM', dataIndex: 'maxRam', key: 'maxRam', width: 70, align: 'center' },
  { title: 'TCP', dataIndex: 'maxTcp', key: 'maxTcp', width: 70, align: 'center' },
  {
    title: 'Kết quả',
    dataIndex: 'status',
    key: 'status',
    width: 90,
    render: (status) => (
      <Tag color={status === 'Đã chặn' ? 'green' : 'red'}>
        {status}
      </Tag>
    )
  },
];

const EvaluationLogs = () => {
  const [logData, setLogData] = useState([]);

  // Fetch dữ liệu mỗi 3 giây
  useEffect(() => {
    const fetchLogs = async () => {
      const data = await dashboardAPI.getEvaluationLogs();
      // Đảo ngược mảng để log mới nhất hiện lên đầu bảng
      setLogData(data.reverse()); 
    };

    fetchLogs(); // Gọi luôn lần đầu
    const interval = setInterval(fetchLogs, 3000);
    return () => clearInterval(interval);
  }, []);
  
  // Hàm xử lý xuất dữ liệu ra file CSV 
  const handleExportCSV = () => {
    let csvContent = "data:text/csv;charset=utf-8,\uFEFF"; 
    // Cập nhật tiêu đề cột cho file Excel
    csvContent += "Bắt đầu,Kết thúc,Kịch bản tấn công,Độ trễ,Băng thông (Min),Tốc độ gói tin PPS (Max),CPU (Max),RAM (Max),Kết nối TCP (Max),Kết quả\n";
    
    // Cập nhật dữ liệu từng dòng
    logData.forEach(row => {
      csvContent += `${row.startTime},${row.endTime},${row.attackType},${row.delay},${row.minBandwidth},"${row.maxPps}",${row.maxCpu},${row.maxRam},${row.maxTcp},${row.status}\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "SNMP_Evaluation_Logs_Full.csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2 style={{ fontSize: '18px', color: '#1f2937', margin: 0 }}>
          Nhật ký Đánh giá Hiệu năng (Performance Evaluation Logs)
        </h2>
        
        <Button type="primary" icon={<Download size={16} />} onClick={handleExportCSV}>
          Xuất Báo cáo (CSV)
        </Button>
      </div>

      <div style={{ overflow: 'hidden' }}>
        <Table 
          dataSource={logData} 
          columns={columns} 
          pagination={false} 
          size="small"
          scroll={{ 
            x: 900,  
            y: 300   
          }} 
        />
      </div>
    </div>
  );
};

export default EvaluationLogs;