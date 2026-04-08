// EvaluationLogs.jsx: Component hiển thị Bảng dữ liệu (Table AntD) theo dõi các đợt tấn công đã xảy ra, cập nhật theo thời gian thực và hỗ trợ nút tải báo cáo xuất file CSV.
import { useState, useEffect } from 'react';
import { Table, Button, Tag } from 'antd';
import { Download, Lock } from 'lucide-react';
import { dashboardAPI } from '../lib/api';

// Cấu hình thông tin cho bảng dữ liệu
const columns = [
  { title: 'Start', dataIndex: 'startTime', key: 'startTime', width: 80 },
  { title: 'End', dataIndex: 'endTime', key: 'endTime', width: 80 },
  { 
    title: 'Attack Scenario', 
    dataIndex: 'attackType', 
    key: 'attackType',
    width: 140,
    render: (text) => <span style={{ fontWeight: 'bold' }}>{text}</span>
  },
  { title: 'Bandwidth', dataIndex: 'minBandwidth', key: 'minBandwidth', width: 100, align: 'center' },
  { title: 'PPS', dataIndex: 'maxPps', key: 'maxPps', width: 80, align: 'center' },
  { title: 'CPU', dataIndex: 'maxCpu', key: 'maxCpu', width: 70, align: 'center' },
  { title: 'RAM', dataIndex: 'maxRam', key: 'maxRam', width: 70, align: 'center' },
  { title: 'TCP', dataIndex: 'maxTcp', key: 'maxTcp', width: 70, align: 'center' },
  {
    title: 'Result',
    dataIndex: 'status',
    key: 'status',
    width: 90,
    render: (status) => (
      <Tag color={status === 'Resolved' || status === 'Success' ? 'green' : (status === 'Failed' ? 'red' : 'orange')}>
        {status}
      </Tag>
    )
  },
];

// Giao diện hiển thị: Một bảng dữ liệu (Table AntD) theo dõi các đợt tấn công đã xảy ra, cập nhật theo thời gian thực và hỗ trợ nút tải báo cáo xuất file CSV.
const EvaluationLogs = ({ selectedIp }) => {
  const [logData, setLogData] = useState([]);
  const [isSupported, setIsSupported] = useState(true);

  // Kiểm tra xem máy Agent này có hỗ trợ IPS không
  useEffect(() => {
    const checkSupport = async () => {
      if (selectedIp) {
        const supported = await dashboardAPI.checkIpsSupport(selectedIp);
        setIsSupported(supported);
      }
    };
    checkSupport();
  }, [selectedIp])

  // Lấy dữ liệu logs tấn công nhận từ API
  useEffect(() => {
    if (!isSupported) return;
    const fetchLogs = async () => {
      const data = await dashboardAPI.getEvaluationLogs();
      setLogData(data.reverse()); 
    };

    fetchLogs();
    // Lấy thông tin logs 3s mỗi lần
    const interval = setInterval(fetchLogs, 3000);
    return () => clearInterval(interval);
  }, [isSupported]);
  
  // Xử lý logic xuất báo cáo
  const handleExportCSV = () => {
    let csvContent = "data:text/csv;charset=utf-8,\uFEFF"; 
    csvContent += "Start Time,End Time,Attack Scenario,Delay,Bandwidth (Min),Packets per Second (Max),CPU (Max),RAM (Max),TCP Connections (Max),Result\n";
    
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

  if (!isSupported) {
    return (
      <div style={{ backgroundColor: '#f9fafb', padding: '40px 20px', borderRadius: '8px', border: '1px dashed #d1d5db', textAlign: 'center', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <Lock size={48} color="#9ca3af" style={{ margin: '0 auto 15px' }} />
        <h3 style={{ color: '#4b5563', marginBottom: '10px' }}>Evaluation Logs - Not Available</h3>
        <p style={{ color: '#6b7280' }}>The IDPS feature is currently only available on the <b>10.0.1.2 (VM1)</b> agent.</p>
      </div>
    );
  }

  return (
    <div style={{ backgroundColor: 'white', padding: '20px', borderRadius: '8px', boxShadow: '0 2px 8px rgba(0,0,0,0.1)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h2 style={{ fontSize: '18px', color: '#1f2937', margin: 0 }}>
          4. Performance Evaluation Logs
        </h2>
        
        <Button type="primary" icon={<Download size={16} />} onClick={handleExportCSV}>
          Export Report (CSV)
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