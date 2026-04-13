#!/bin/bash
# Script kích hoạt tường lửa Iptables để chặn 3 loại tấn công SYN Flood, ICMP Ping Flood và UDP Flood

# Nếu nhận được lệnh SET từ NMS (VM2) thì kích hoạt tường lửa Iptables
if [ "$1" = "-s" ]; then
    # Đọc tham số loại tấn công nhận được từ NMS
    ATTACK_TYPE="$4"
    
    case "$ATTACK_TYPE" in
        "1")
            # Chặn tấn công TCP SYN Flood
            sudo /sbin/iptables -I INPUT -p tcp --syn -m limit --limit 10/s -j ACCEPT
            sudo /sbin/iptables -A INPUT -p tcp --syn -j DROP
            echo "$(date): Enabled TCP SYN Shield!" >> /var/log/snmp_mitigation.log
            ;;
        "2")
            # Chặn tấn công UDP Flood
            sudo /sbin/iptables -A INPUT -p udp --dport 161 -j ACCEPT
            sudo /sbin/iptables -A INPUT -p udp -m limit --limit 20/s -j ACCEPT
            sudo /sbin/iptables -A INPUT -p udp -j DROP
            echo "$(date): Enabled UDP Shield!" >> /var/log/snmp_mitigation.log
            ;;
        "3")
            # Chặn tấn công ICMP Ping Flood / Traffic Spike
            sudo /sbin/iptables -A INPUT -p icmp --icmp-type echo-request -j DROP
            echo "$(date): Enabled ICMP / Traffic Spike Shield!" >> /var/log/snmp_mitigation.log
            ;;
        *)
            echo "$(date): Unknown Attack Type Received: $ATTACK_TYPE" >> /var/log/snmp_mitigation.log
            ;;
    esac
    exit 0
fi

# Nếu nhận được lệnh GET từ NMS (VM2), trả về giá trị 1 để báo hiệu script vẫn hoạt động
if [ "$1" = "-g" ]; then
    echo ".1.3.6.1.4.1.9999.1.0"
    echo "integer"
    echo "1"
    exit 0
fi

exit 0