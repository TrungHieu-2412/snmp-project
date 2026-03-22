import React from 'react';
import { Table, Button, Tag } from 'antd';
import { Download } from 'lucide-react';

const logData = [
  {
    key: '1',
    startTime: '10:00:15',
    endTime: '10:00:45',
    attackType: 'UDP Flood',
    delay: '10s',
    minBandwidth: '5 Mbps',
    maxPps: '25,000',
    maxCpu: '98%',
    maxRam: '80%',
    maxTcp: '45',
    status: 'Đã chặn',
  },
  {
    key: '2',
    startTime: '09:30:00',
    endTime: '09:30:15',
    attackType: 'TCP SYN Flood',
    delay: '0s',
    minBandwidth: '85 Mbps',
    maxPps: '1,200',
    maxCpu: '30%',
    maxRam: '55%',
    maxTcp: '450', 
    status: 'Đã chặn',
  },
  {
    key: '3',
    startTime: '08:15:20',
    endTime: '08:16:00',
    attackType: 'TCP ACK Flood',
    delay: '30s',
    minBandwidth: '2 Mbps',
    maxPps: '35,000',
    maxCpu: '100%',
    maxRam: '95%',
    maxTcp: '60',
    status: 'Tê liệt',
  },
  {
    key: '4', 
    startTime: '07:45:00', 
    endTime: '07:45:20', 
    attackType: 'UDP Flood', 
    delay: '0s', 
    minBandwidth: '45 Mbps', 
    maxPps: '18,000', 
    maxCpu: '85%', 
    maxRam: '70%', 
    maxTcp: '30', 
    status: 'Đã chặn',
  },
  {
    key: '5', 
    startTime: '06:10:00', 
    endTime: '06:11:30', 
    attackType: 'TCP SYN Flood', 
    delay: '10s', 
    minBandwidth: '60 Mbps', 
    maxPps: '5,000', 
    maxCpu: '60%', 
    maxRam: '65%', 
    maxTcp: '380', 
    status: 'Đã chặn',
  },
];

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
  { 
    title: 'Độ trễ', 
    dataIndex: 'delay', 
    key: 'delay',
    width: 70,
    render: (text) => <Tag color="blue">{text}</Tag>
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
          4. Bảng Nhật ký Đánh giá Hiệu năng
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