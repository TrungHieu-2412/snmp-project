<div align="center">

# SNMP Security Monitoring System

### Hệ thống Giám sát Mạng và Phản ứng Bảo mật Tự động sử dụng Giao thức SNMP

[![Java](https://img.shields.io/badge/Java-17+-ED8B00?style=flat-square&logo=openjdk&logoColor=white)](https://openjdk.org)
[![Spring Boot](https://img.shields.io/badge/Spring_Boot-3.x-6DB33F?style=flat-square&logo=springboot&logoColor=white)](https://spring.io/projects/spring-boot)
[![React](https://img.shields.io/badge/React-18+-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev)
[![SNMP4J](https://img.shields.io/badge/SNMP4J-3.x-0078D7?style=flat-square)](https://www.snmp4j.org)
[![GCP](https://img.shields.io/badge/GCP-3_VMs-4285F4?style=flat-square&logo=googlecloud&logoColor=white)](https://cloud.google.com)
[![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)](LICENSE)

**Học phần:** NT531.Q22 - Đánh giá hiệu năng hệ thống mạng máy tính · UIT

| Thành viên             | Email                  | Phụ trách                                        |
| ---------------------- | ---------------------- | ------------------------------------------------ |
| Trần Nguyễn Việt Hoàng | 23520541@gm.uit.edu.vn | SNMP Agent + NMS + Benchmark + Security Analysis |
| Nguyễn Trung Hiếu      | 23520487@gm.uit.edu.vn | GET/SET/TRAP + iptables + Topology + Web UI      |

</div>

---

## 📖 Tổng quan

Hệ thống này là một **nền tảng giám sát mạng và bảo mật end-to-end** được xây dựng trên giao thức SNMP. Điểm nổi bật là khả năng **tự động phát hiện và ngăn chặn tấn công SYN Flood**: khi máy Agent phát hiện lưu lượng TCP bất thường, nó sẽ gửi SNMP TRAP cảnh báo đến máy Manager (NMS), Manager lập tức phản hồi bằng lệnh SNMP SET để kích hoạt rule `iptables` chặn kẻ tấn công — **toàn bộ quy trình hoàn toàn tự động**.

```
[VM3 - Attacker]  ──── SYN Flood ────►  [VM1 - Agent/Victim]
                                                │
                                    snmpd phát hiện TCP bất thường (SYN Flood)
                                                │ TRAP
                                                ▼
                                        [VM2 - NMS Manager]
                                         Spring Boot + SNMP4J
                                                │ SET (kích hoạt block_attacker.sh)
                                                ▼
                                        [VM1 - Agent/Victim]
                                         iptables -A INPUT -p tcp --syn -j DROP
```

---

## ✨ Tính năng Cốt lõi

| #   | Tính năng                                                                          | Công nghệ                          |
| --- | ---------------------------------------------------------------------------------- | ---------------------------------- |
| 1   | **Real-time Monitoring** CPU, RAM, Tốc độ mạng (Kbps), PPS của nhiều Agent         | SNMP GET + Spring Scheduler        |
| 2   | **Automated IPS** Tự phát hiện SYN Flood và kích hoạt iptables trong < 10s         | SNMP TRAP + SET + Net-SNMP monitor |
| 3   | **Auto / Manual Mode** Tuỳ chọn tự động hoặc để admin ra lệnh thủ công             | ControlPanel UI + REST API         |
| 4   | **Protocol Benchmark** So sánh hiệu năng SNMPv1, v2c, v3 (GET / GETNEXT / GETBULK) | ProtocolPerformanceController      |
| 5   | **Security Packet Sniffer** Phân tích payload Raw UDP, so sánh bảo mật phiên bản   | ProtocolSecurityController         |
| 6   | **Network Topology** Sơ đồ mạng trực quan với luồng gói tin động SVG               | NetworkTopology.jsx                |
| 7   | **Live Charts** Biểu đồ cuộn ngang real-time với Smart Auto-Scroll                 | Recharts + React                   |
| 8   | **Evaluation Logs** Nhật ký đo lường hiệu năng trước/sau mỗi đợt tấn công          | TrapReceiverService                |
| 9   | **Multi-Agent Support** Giám sát đồng thời nhiều máy Agent, chuyển đổi qua URL     | TopHeader + URL Param              |
| 10  | **Configurable Delay** Điều chỉnh thời gian trễ phản ứng để đánh giá hiệu quả      | REST API + UI Slider               |

---

## 🏗️ Kiến trúc Hệ thống

```
                     ┌──────────────────────────────────────┐
                     │          Google Cloud Platform       │
                     │                                      │
                     │  ┌───────────────────────────────┐   │
                     │  │  VM2 - NMS Manager (10.0.1.3) │   │
                     │  │  Spring Boot :8080            │   │
                     │  │  ┌─────────────────────────┐  │   │
                     │  │  │ SnmpPollerService       │  │   │
                     │  │  │ GET mỗi 3s -> /metrics  │  │   │
                     │  │  ├─────────────────────────┤  │   │
                     │  │  │ TrapReceiverService     │  │   │
                     │  │  │ Lắng nghe TRAP :10162   │  │   │
                     │  │  │ -> SET block_attacker.sh│  │   │
                     │  │  ├─────────────────────────┤  │   │
                     │  │  │ DashboardController     │  │   │
                     │  │  │ REST API /api/*         │  │   │
                     │  │  └─────────────────────────┘  │   │
                     │  └───────┬───────────────────────┘   │
                     │          │ SNMP GET/SET (UDP:161)    │
                     │          │ TRAP (UDP:10162)          │
                     │    ┌─────▼──────┐   ┌────────────┐   │
                     │    │ VM1 Agent  │   │ VM3 Attcker│   │
                     │    │ 10.0.1.2   │   │ 10.0.2.2   │   │
                     │    │ Net-SNMP   │◄──│ hping3     │   │
                     │    │ snmpd      │   │ SYN Flood  │   │
                     │    │ iptables   │   └────────────┘   │
                     │    └────────────┘                    │
                     └──────────────────────────────────────┘
                                      │
                              React Dashboard
                              Vite Dev / Build
                              VITE_API_BASE -> VM2:8080
```

---

## 🛠️ Technology Stack

| Layer                 | Technology                                        |
| --------------------- | ------------------------------------------------- |
| **NMS Backend**       | Java 17 + Spring Boot 3 + SNMP4J 3                |
| **SNMP Agent**        | Net-SNMP (`snmpd`) + SNMPv1/v2c/v3 + iptables     |
| **Frontend**          | React 18 + Vite + Recharts + Lucide React         |
| **UI Framework**      | Ant Design (bảng, nút) + Vanilla CSS (charts)     |
| **API Communication** | REST over HTTP (Fetch API)                        |
| **Router**            | React Router DOM v6                               |
| **Infrastructure**    | Google Cloud Platform - 3 VM instances (e2-micro) |
| **Build Tool (BE)**   | Apache Maven                                      |
| **Build Tool (FE)**   | pnpm + Vite                                       |

---

## 🖥️ Mô tả Hạ tầng GCP

| VM  | Role           | Internal IP | Port mở                   | Chức năng                                 |
| --- | -------------- | ----------- | ------------------------- | ----------------------------------------- |
| VM1 | Agent / Victim | 10.0.1.2    | TCP:80, UDP:161           | Chạy Net-SNMP Agent, mục tiêu bị tấn công |
| VM2 | NMS Manager    | 10.0.1.3    | TCP:8080, UDP:162, :10162 | Spring Boot NMS, nhận GET, TRAP, gửi SET  |
| VM3 | Attacker       | 10.0.2.2    | TCP:22, ICMP              | Mô phỏng tấn công SYN Flood               |

---

## 📁 Cấu trúc Thư mục

```
snmp-project/
├── VM1/                               # Cấu hình triển khai lên máy Agent (VM1)
│   ├── snmpd.conf                     # Cấu hình Net-SNMP: community, TRAP, monitor rule
│   └── block_attacker.sh              # Script kích hoạt iptables khi nhận lệnh SNMP SET
│
├── api/
│   └── JavaSNMP/                       # NMS Backend (Spring Boot)
│       └── src/main/java/org/example/
│           ├── Main.java               # Entry point - khởi động Spring Boot App
│           ├── SnmpPollerService.java  # GET định kỳ 3s -> CPU, RAM, BW, PPS, TCP
│           ├── TrapReceiverService.java  # Nhận TRAP cảnh báo -> gửi SET phản công
│           ├── DashboardController.java  # REST API /api/* cho Frontend
│           ├── ProtocolPerformanceController.java  # Benchmark SNMPv1/v2c/v3
│           └── ProtocolSecurityController.java     # Demo bảo mật payload packets
│
└── web/                               # Frontend Dashboard (React + Vite)
    ├── .env                           # VITE_API_BASE=http://<VM2_IP>:8080/api
    ├── index.html
    └── src/
        ├── App.jsx                    # Router: / -> Overview, /benchmark, /topology
        ├── lib/
        │   └── api.js                 # Tập trung toàn bộ hàm gọi API Backend
        ├── pages/
        │   ├── MainLayout.jsx         # Layout chính: polling IP, TopHeader, Outlet
        │   ├── OverviewPage.jsx       # Trang tổng quan: 4 component dạng lưới 2 cột
        │   ├── BenchmarkPage.jsx      # Trang Benchmark giao thức SNMP
        │   └── TopologyPage.jsx       # Trang Sơ đồ mạng Topology
        └── components/
            ├── TopHeader.jsx          # Thanh điều hướng: chọn Agent IP, thêm Agent
            ├── NetworkPerformance.jsx # Biểu đồ Throughput (Mbps) + PPS cuộn ngang
            ├── SystemResources.jsx    # Biểu đồ CPU/RAM + Đồng hồ TCP connections
            ├── ControlPanel.jsx       # Bảng điều khiển Auto-IPS, delay, kích hoạt thủ công
            ├── EvaluationLogs.jsx     # Bảng nhật ký đo lường sau mỗi đợt tấn công
            ├── NetworkTopology.jsx    # Sơ đồ 3 VM với luồng gói tin SVG động
            ├── ProtocolComparison.jsx # Biểu đồ cột benchmark SNMPv1/v2c/v3
            └── SecurityAnalyzer.jsx   # Phân tích payload Raw UDP, so sánh bảo mật
```

---

## 🚀 Hướng dẫn Cài đặt và Khởi chạy

### Yêu cầu Hệ thống

| Thành phần | Tối thiểu | Ghi chú                                 |
| ---------- | --------- | --------------------------------------- |
| Java       | 17+       | OpenJDK khuyến nghị                     |
| Maven      | 3.8+      | Để build backend                        |
| Node.js    | 18+       | Để chạy frontend                        |
| pnpm       | 8+        | `npm install -g pnpm`                   |
| Net-SNMP   | 5.9+      | Cài trên VM Agent (`apt install snmpd`) |

---

### Bước 1: Cấu hình SNMP Agent (VM1)

Sao chép các file cấu hình từ thư mục `VM1/` lên máy Agent:

```bash
# Trên VM1
sudo cp snmpd.conf /etc/snmp/snmpd.conf
sudo cp block_attacker.sh /usr/local/bin/block_attacker.sh
sudo chmod +x /usr/local/bin/block_attacker.sh

# Cấp quyền sudo cho snmpd để chạy iptables mà không cần mật khẩu
echo "snmp ALL=(ALL) NOPASSWD: /sbin/iptables" | sudo tee /etc/sudoers.d/snmp

# Khởi động lại snmpd
sudo systemctl restart snmpd
sudo systemctl status snmpd
```

Kiểm tra Agent đang phản hồi SNMP (chạy từ VM2):

```bash
snmpget -v2c -c public 10.0.1.2 sysDescr.0
```

---

### Bước 2: Build và chạy NMS Backend (VM2)

```bash
# Clone/copy project lên VM2
cd api/JavaSNMP

# Build JAR
mvn clean package -DskipTests

# Chạy ứng dụng
java -jar target/JavaSNMP-1.0-SNAPSHOT.jar

# Hoặc chạy nền (production)
nohup java -jar target/JavaSNMP-1.0-SNAPSHOT.jar > app.log 2>&1 &
```

Xác nhận server đang chạy:

```bash
curl http://localhost:8080/api/metrics
```

> **Lưu ý:** Để BE tự khởi động khi VM2 reboot, tạo systemd service:
>
> ```bash
> sudo nano /etc/systemd/system/snmp-nms.service
> ```
>
> ```ini
> [Unit]
> Description=SNMP NMS Spring Boot App
> After=network.target
>
> [Service]
> User=your_user
> WorkingDirectory=/path/to/api/JavaSNMP
> ExecStart=java -jar target/JavaSNMP-1.0-SNAPSHOT.jar
> Restart=always
>
> [Install]
> WantedBy=multi-user.target
> ```
>
> ```bash
> sudo systemctl enable snmp-nms
> sudo systemctl start snmp-nms
> ```

---

### Bước 3: Cấu hình và chạy Frontend (máy local hoặc máy bất kỳ)

```bash
# Di chuyển vào thư mục web
cd web

# Cài đặt dependencies
pnpm install

# Cấu hình địa chỉ API Backend
echo "VITE_API_BASE=http://<PUBLIC_IP_VM2>:8080/api" > .env

# Chạy chế độ Development
pnpm run dev

# Build Production
pnpm run build
pnpm run preview
```

---

### Bước 4: Mô phỏng tấn công SYN Flood (VM3)

```bash
# Trên VM3 (Kali Linux)
sudo hping3 -S --flood -p 80 10.0.1.2

# Theo dõi phản ứng trên VM1
sudo iptables -L INPUT -n -v

# Theo dõi log trên VM1
tail -f /var/log/snmp_mitigation.log

# Theo dõi log trên VM2
tail -f app.log | grep -E "TRAP|SET|MITIGATION"
```

---

### 🔧 Xử lý Sự cố Thường gặp

| Vấn đề                          | Nguyên nhân                        | Giải pháp                                              |
| ------------------------------- | ---------------------------------- | ------------------------------------------------------ |
| Backend không nhận TRAP         | Firewall GCP chặn UDP:10162        | Thêm rule `snmp-fw-allow-manager` cho UDP 10162        |
| SNMP GET trả về `Timeout`       | snmpd chưa chạy hoặc sai Community | `sudo systemctl restart snmpd` + kiểm tra `snmpd.conf` |
| SET không kích hoạt iptables    | snmpd thiếu quyền sudo             | Cấu hình `/etc/sudoers.d/snmp`                         |
| Frontend không kết nối được API | `VITE_API_BASE` sai IP hoặc port   | Cập nhật `web/.env` với IP Public đúng của VM2         |
| Biểu đồ không có dữ liệu        | Agent IP chưa được thêm vào NMS    | Nhấn nút "Add Agent" trên TopHeader với IP của VM1     |

---

## 🔌 REST API Reference

| Method | Endpoint                               | Mô tả                                                |
| ------ | -------------------------------------- | ---------------------------------------------------- |
| GET    | `/api/metrics`                         | Lấy metric realtime (CPU, RAM, BW, PPS) tất cả Agent |
| POST   | `/api/device/add?ip=<IP>`              | Thêm Agent IP mới vào hệ thống giám sát              |
| GET    | `/api/alerts`                          | Lấy danh sách TRAP cảnh báo đã nhận                  |
| POST   | `/api/config/protect?targetIp=<IP>`    | Kích hoạt iptables thủ công trên Agent               |
| POST   | `/api/config/delay?delay=<sec>`        | Cập nhật thời gian trễ phản ứng IPS                  |
| POST   | `/api/config/auto-mode?enabled=<bool>` | Bật/Tắt chế độ Auto-IPS                              |
| GET    | `/api/logs`                            | Lấy Evaluation Logs sau mỗi đợt tấn công             |
| GET    | `/api/features/ips-support?ip=<IP>`    | Kiểm tra Agent có hỗ trợ TRAP -> SET không           |
| GET    | `/api/benchmark/run?ip=<IP>`           | Chạy Benchmark SNMPv1/v2c/v3                         |
| GET    | `/api/benchmark/security-demo?ip=<IP>` | Capture & phân tích raw UDP packets                  |

---

## 📊 Luồng Polling Metric (SNMP GET)

```
[VM2 - NMS Manager]
      │
      │ (Định kỳ 3 giây/lần)
      ▼
Gửi request SNMP GET (v2c) ───── (UDP:161) ─────┐
      │                                         │
      │  - CPU OID (UCD-SNMP)                   │
      │  - RAM OID (UCD-SNMP)                   │
      │  - Bandwidth OIDs (MIB-II)              │
      │  - TCP OID (MIB-II)                     │
      ▼                                         │
[VM1 - Agent/Victim] ◄──────────────────────────┘
      │
      │  - Đọc giá trị từ Kernel
      │  - Trả về PDU Response ─── (UDP:161) ───┐
      │                                         │
      ▼                                         │
[VM2 - NMS Manager] ◄───────────────────────────┘
      │
      │  - Tính toán Delta (Băng thông, PPS)
      │  - Chuyển đổi công thức (Kbps, %)
      │  - Lưu dữ liệu vào ConcurrentHashMap (RAM)
      ▼
[React Frontend] ◄── REST /api/metrics ───────┘
```

---

## 🔐 Luồng Bảo mật Auto-IPS (SNMP TRAP & SET)

```
[VM3 - Attacker] ─── Tấn công (hping3)
      │
      │ SYN Flood (TCP: 80)
      ▼
[VM1 - Agent/Victim]
      │
      │  - Phát hiện tấn công: monitor tcp.currEstab > 2000
      │  - Gửi TRAP về NMS Manager  ────────────────┐
      │                                             │
      ▼                                             │
[VM2 - NMS Manager] ◄──── SNMP TRAP (UDP:10162) ────┘
      │
      │  - Nhận TRAP tại TrapReceiverService
      │  - Kiểm tra Chế độ Auto-IPS
      │  - Đợi <delay> giây (nếu có)
      │  - Gửi lệnh SNMP SET (v2c) ─────────────────┐
      │                                             │
      │    OID: 1.3.6.1.4.1.9999.1.0                │
      │    Value: 1 (Activate)                      │
      ▼                                             │
[VM1 - Agent/Victim] ◄───── Command (UDP:161) ──────┘
      │
      │  - snmpd gọi block_attacker.sh
      │  - Thực thi: iptables -A INPUT -s 10.0.2.2 -j DROP
      ▼
[VM2 - NMS Manager] ◄──────── Status Update ─────────────┘
      │
      │  - Ghi Evaluation Log (Trước/Sau)
      │  - Cập nhật Alert trên Dashboard
      ▼
[React Frontend] ◄──── REST /api/alerts ────────┘
```

---

## 🚀 Luồng Benchmark Hiệu năng (SNMPv1 vs v2c vs v3)

```
[React Frontend] ──── Trigger Benchmark ────► [VM2 - NMS Manager]
      ▲                                             │
      │                                             │ GET (UDP:161)
      │                                             ▼
      │    ┌─── Truy vấn GET (UDP:161) ─────► [VM1 - Agent/Victim]
      │    │                                        │
      │    │  - SNMPv1: 50 × GETNEXT (Tuần tự)      │
      │    │  - SNMPv2c: 1 × GETBULK (50 OIDs)      │
      │    │  - SNMPv3: 1 × GETBULK (Auth+Priv)     │
      │    │                                        │
      │    └─── Response (PDU) ◄────────────────────┘
      │             │
      │             │ Xử lý tại NMS:
      │             │  - Đo thời gian hoàn thành (ms)
      │             │  - Tính Throughput (oids/giây)
      │             ▼
      └────── Kết quả so sánh (JSON) ───────────────┘
```

---

## 🛡️ Luồng Phân tích Bảo mật (Packet Sniffer)

```
[React Frontend] ──── Trigger Security ────► [VM2 - NMS Manager]
      ▲                                             │
      │                                             │ GET (UDP:161)
      │                                             ▼
      │    ┌─── Truy vấn GET (UDP:161) ────► [VM1 - Agent/Victim]
      │    │                                        │
      │    │  - Sniff raw UDP payload               │
      │    │  - SNMPv1/v2c: Plaintext PDU           │
      │    │  - SNMPv3: Encrypted ScopedPDU         │
      │    │                                        │
      │    └─── Response (PDU) ◄────────────────────┘
      │             │
      │             │ Xử lý tại NMS:
      │             │  - Chuyển byte[] sang định dạng Hex
      │             │  - Chuyển byte[] sang ASCII (Mô tả nội dung)
      │             ▼
      └────── Kết quả phân tích (JSON) ───────────────┘
```

---

## 📚 Tài liệu Liên quan

| Tài liệu                                                | Mô tả                                                 |
| ------------------------------------------------------- | ----------------------------------------------------- |
| [Net-SNMP Documentation](http://www.net-snmp.org/docs/) | Tài liệu cấu hình `snmpd.conf` và `monitor` directive |
| [SNMP4J Docs](https://www.snmp4j.org/doc/)              | API Java cho SNMP GET, GETNEXT, GETBULK, SET, TRAP    |
| [Spring Boot Docs](https://docs.spring.io/spring-boot/) | Khung ứng dụng Java cho NMS Backend                   |
| [Recharts](https://recharts.org/en-US/)                 | Thư viện vẽ biểu đồ React                             |
| [RFC 3411-3418](https://www.rfc-editor.org/rfc/rfc3411) | Đặc tả giao thức SNMPv3                               |

---

<div align="center">

_Developed for UIT · NT204 · SNMP Security Monitoring System Project_

</div>
