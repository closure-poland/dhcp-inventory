#!/bin/sh
# This is an example Dynamic Inventory script for ansible.
# For usage details, please visit http://docs.ansible.com/intro_dynamic_inventory.html

# On the host where dnsmasq is running, in the dhcp-inventory installation directory, do: `bin/ansible-http.js`
# Then, direct your wget below to the appropriate URL.
# The "format" flag tells the server to serve IP addresses, in case the ansible client is not using dnsmasq's DNS.
# Also, active=true only selects hosts that are on-line according to dhcp-inventory.

# You can check if ansible is finding your hosts when using the -i option (in this example, the "test" group is checked):
# `ansible -i /somewhere/dhcp-inventory/examples/ansible-hosts.sh --list-hosts test`

wget -O- http://192.168.0.117:8067/?format=ip\&active=true
