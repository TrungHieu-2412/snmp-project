#!/bin/bash
# Script tự động phát hiện và gửi SNMP Trap về NMS (VM2)

# IP của NMS Manager (VM2) và cổng Trap
MANAGER_IP="10.0.1.3:10162"
COMMUNITY="public"

# Ngưỡng phát hiện tấn công (Số gói tin / 1 giây)
THRESHOLD_TCP=5000
THRESHOLD_UDP=5000
THRESHOLD_TOTAL=15000

# Tự động lấy tên card mạng chính đang kết nối Internet
INTERFACE=$(ip route | grep default | awk '{print $5}')

echo "🛡️ Auto Sensor IDPS is running on interface $INTERFACE. Waiting for attacks..."

# Lấy giá trị khởi tạo ban đầu
PREV_TCP=$(cat /proc/net/snmp | grep Tcp: | awk 'NR==2 {print $11}') # Tổng tất cả các gói tin TCP bay vào
PREV_UDP=$(cat /proc/net/snmp | grep Udp: | awk 'NR==2 {print $2 + $3 + $4}')  # Số lượng gói UDP nhận vào ($2 là UDP hợp lệ, $3 là UDP đập vào port đóng, $4 là UDP bị lỗi)
PREV_PKT=$(cat /sys/class/net/$INTERFACE/statistics/rx_packets) # Tổng số gói tin nhận vào

while true; do
    sleep 1
    # Lấy giá trị hiện tại
    CURR_TCP=$(cat /proc/net/snmp | grep Tcp: | awk 'NR==2 {print $11}')
    CURR_UDP=$(cat /proc/net/snmp | grep Udp: | awk 'NR==2 {print $2 + $3 + $4}')
    CURR_PKT=$(cat /sys/class/net/$INTERFACE/statistics/rx_packets)

    # Tính toán Delta (chênh lệch trong 1 giây)
    DELTA_TCP=$((CURR_TCP - PREV_TCP))
    DELTA_UDP=$((CURR_UDP - PREV_UDP))
    DELTA_PKT=$((CURR_PKT - PREV_PKT))

    # In ra màn hình để theo dõi 
    echo -ne "Monitoring... Delta [TCP: $DELTA_TCP | UDP: $DELTA_UDP | PKT: $DELTA_PKT]     \r"

    ATTACK_DETECTED=""

    # Phân loại tấn công dựa trên Delta
    if [ "$DELTA_TCP" -gt "$THRESHOLD_TCP" ]; then
        ATTACK_DETECTED="SYN_FLOOD_DETECTED"
        echo -e "\n$(date): 🚨 TCP SYN Attack! Sending TRAP..."

    elif [ "$DELTA_UDP" -gt "$THRESHOLD_UDP" ]; then
        ATTACK_DETECTED="UDP_FLOOD_DETECTED"
        echo -e "\n$(date): 🚨 UDP Flood Attack! Sending TRAP..."

    elif [ "$DELTA_PKT" -gt "$THRESHOLD_TOTAL" ]; then
        ATTACK_DETECTED="GENERAL_TRAFFIC_SPIKE"
        echo -e "\n$(date): 🚨 General Traffic Spike! Sending TRAP..."
    fi

    # Nếu có tấn công, bắn TRAP về VM2
    if [ -n "$ATTACK_DETECTED" ]; then
        # snmptrap -v2c -c <community> <ip:port> <uptime> <OID_Trap> <OID_Biến> <Loại_dữ_liệu> <Giá_trị>
        snmptrap -v2c -c $COMMUNITY $MANAGER_IP "" 1.3.6.1.4.1.9999.2.0 1.3.6.1.4.1.9999.2.1 s "$ATTACK_DETECTED"

        # Nghỉ 5 giây để tránh gửi TRAP báo động quá liên tục làm nghẽn terminal
        sleep 5

        # Cập nhật giá trị sau khi nghỉ để tránh tính sai Delta ở vòng lặp kế tiếp
        CURR_TCP=$(cat /proc/net/snmp | grep Tcp: | awk 'NR==2 {print $11}')
        CURR_UDP=$(cat /proc/net/snmp | grep Udp: | awk 'NR==2 {print $2 + $3 + $4}')
        CURR_PKT=$(cat /sys/class/net/$INTERFACE/statistics/rx_packets)
    fi

    # Lưu giá trị cũ cho vòng lặp tiếp theo
    PREV_TCP=$CURR_TCP
    PREV_UDP=$CURR_UDP
    PREV_PKT=$CURR_PKT
done