#!/bin/bash
# Script lang nghe lenh tu snmpd thong qua directive 'pass'

# Neu nhan duoc lenh SET, chay iptables
if [ "$1" = "-s" ]; then
    sudo /sbin/iptables -I INPUT -p tcp --syn -m limit --limit 10/s -j ACCEPT
    sudo /sbin/iptables -A INPUT -p tcp --syn -j DROP

    echo "$(date): Enable Iptables to prevent SYN Flood attacks!" >> /var/log/snmp_mitigation.log
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