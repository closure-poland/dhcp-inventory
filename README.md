# dhcp-inventory

## What?
If you're a network/system administrator, you may often find yourself in the following situation:
* There's a bunch of hosts in a subnet that need DHCP and DNS names
* Somebody needs to bring them all up, identify them and assign static DHCP mappings / host names
* That somebody *might just happen to be you*

This tool, in conjunction with a supported DHCP/DNS server (currently, dnsmasq), aims to facilitate that tedious process and make you a happier admin. It is designed for small networks at the moment, but may scale in the near future once additional features (e.g. multiple domain support) are in place.

## How?
You may already know about `dnsmasq` - a great, lightweight daemon that integrates a DHCP server and a DNS server/resolver. We will be using it to manage the network segment - it is going to handle IP address assignments, local DNS (your hosts will be using it as the default resolver) and also DHCP options which control the default routes that your hosts choose.

Meanwhile, you are going to manage good-looking, colorful lists of hosts and update static DHCP mappings automatically.

As a bonus, __dhcp-inventory__ is designed to interfere as little as possible with any current dnsmasq setup you may have.

# Usage notes

This software makes a few assumptions about your dnsmasq installation:
* `dhcp-script` is supported in your dnsmasq version (valid as of Debian Wheezy)
* `/etc/dnsmasq.d/` is used as a modular configuration directory (i.e. snippets are read from here)

# Installation

## dnsmasq
_(Skip this step if you already have dnsmasq installed.)_

On Debian/Ubuntu:

```
apt-get install dnsmasq
```

## installing dhcp-inventory

For now, just clone the repository and install all dependencies:

```
git clone git@github.com:closure-poland/dhcp-inventory.git
cd dhcp-inventory
npm install
```

## pool set-up
_(Skip this step if you are already serving DHCP on a subnet.)_

First, open the dnsmasq configuration file, /etc/dnsmasq.conf .

Find and uncomment a __dhcp-range__ statement which corresponds to an address range in a subnet on one of your interfaces. Also set some __domain__ for host resolution.

## dhcp-inventory integration

Again, in the dnsmasq configuration file, set the following option:

```
dhcp-script=/root/dhcp-inventory/bin/dnsmasq.js
```

This will tell dnsmasq to register all lease changes with dhcp-inventory. Our script will manage an internal lease database and use it to compare your settings to the current server state.

# CLI usage

```sh
# Display a list of all hosts (leases + static mappings)
bin/inventory.js list
# Create static host mappings
bin/inventory.js map 11:22:33:44:55:66 1.2.3.4 some-host-name
bin/inventory.js map 11:22:33:aa:bb:cc 1.2.3.5 another-host
# Delete the mapping
bin/inventory.js unmap 11:22:33:44:55:66
# Export our mappings (only static, not temporary leases) to dnsmasq
bin/inventory.js export --type dnsmasq --apply
```

## Host list format
In the "list" action output, both active leases of the DHCP server and the configured (mapped) hosts are included. In case a host is both configured and active, the two entries are merged into one and flagged appropriately.

The host list is displayed in columns as follows, where the multiple $misc groups are optional:
```
$macaddr $ipaddr $hostname [$flags] ($misc) ($misc)
```

For example:

```
52:54:00:e5:a9:16 172.18.20.104 dhcp-client [active,known,conformant]
```

Possible host flags and their meaning:
* active: there is currently a lease for this host
* known: the host is configured statically in __dhcp-inventory__'s internal database (mapped)
* conformant: the host is known and active, and its leased IP address and hostname both correspond to the configured values

Additionally, "conformant" entries are displayed in green, "non-conformant active" as yellow (as a warning sign), "known inactive" in grey, and "unknown active" appear red. Unknown (non-mapped) inactive hosts are not displayed, since the tool does not know about them.

If you have mapped a host but it is still non-conformant, you may need to export the settings to dnsmasq, restart the server and then re-request the lease on the DHCP client (restart the interface or reboot it).

# License
MIT.