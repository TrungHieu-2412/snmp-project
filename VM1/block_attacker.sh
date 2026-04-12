#!/bin/bash
# Script lang nghe lenh tu snmpd thong qua directive 'pass'

# Neu nhan duoc lenh SET tu NMS (VM2), chay iptables de chan ca 3 loai tan cong
if [ "$1" = "-s" ]; then
    
    # Chặn TCP SYN Flood
    # Chỉ cho phép tối đa 10 gói SYN/giây (người dùng thật), còn lại DROP hết
    sudo /sbin/iptables -I INPUT -p tcp --syn -m limit --limit 10/s -j ACCEPT
    sudo /sbin/iptables -A INPUT -p tcp --syn -j DROP

    # Chặn ICMP Ping Flood / Traffic Spike
    # Cấm hoàn toàn các gói Ping (echo-request).Triệt tiêu gói tin trả lời (Out) của VM1
    sudo /sbin/iptables -A INPUT -p icmp --icmp-type echo-request -j DROP

    # Chặn UDP Flood
    # Cho phép mọi gói UDP Port 161 (SNMP) từ bất kỳ đâu (hoặc từ VM2) đi qua không giới hạn
    sudo /sbin/iptables -A INPUT -p udp --dport 161 -j ACCEPT
    # Tương tự TCP, chỉ cho phép mức UDP cơ bản đi qua, chặn đứng bão UDP rác
    sudo /sbin/iptables -A INPUT -p udp -m limit --limit 20/s -j ACCEPT
    sudo /sbin/iptables -A INPUT -p udp -j DROP

    echo "$(date): Enable Multi-Vector Iptables Shield (TCP/UDP/ICMP)!" >> /var/log/snmp_mitigation.log
    exit 0
fi

# Neu nhan duoc lenh GET, tra ve gia tri gia de bao hieu script van song
if [ "$1" = "-g" ]; then
    echo ".1.3.6.1.4.1.9999.1.0"
    echo "integer"
    echo "1"
    exit 0
fi

exit 0