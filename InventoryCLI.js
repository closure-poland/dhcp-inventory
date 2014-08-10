var colors = require('colors');

colors.setTheme({
	known: 'green',
	warning: 'yellow',
	unknown: 'red',
	inactive: 'grey'
});

function InventoryCLI(inventory){
	this.db = inventory;
}

InventoryCLI.prototype.init = function init(){
	return this.db.open();
};

function isKnown(host){
	return typeof(host.mapping_ip) === 'string' && host.mapping_ip.length > 0;
};

function isActive(host){
	return typeof(host.lease_ip) === 'string' && host.lease_ip.length > 0;
};

function isConformant(host){
	return isKnown(host) && isActive(host) && host.lease_ip === host.mapping_ip && host.lease_hostname === host.mapping_hostname;
};

InventoryCLI.prototype.list = function list(params){
	if(!params){
		params = {};
	}
	
	var useColors = Boolean(params.colors) || Boolean(params.colours);
	// Filters:
	var showActive = Boolean(params.active);
	var showInactive = Boolean(params.inactive);
	var showKnown = Boolean(params.known);
	var showUnknown = Boolean(params.unknown);
	var showConformant = Boolean(params.conformant);
	var showNonconformant = Boolean(params.nonconformant);
	// If no criteria specified, just show all entry states.
	var showAll = !(showActive || showInactive || showKnown || showUnknown);
	
	return this.db.getHosts().then(function generateHostList(hostList){
		return hostList.map(function generateHostLine(host){
			// Guard clause: Skip entries that are unknown and inactive. These entries should not be here in any case.
			if(!isKnown(host) && !isActive(host)){
				return;
			}
			
			var known = isKnown(host);
			var active = isActive(host);
			var conformant = isConformant(host);
			// Skip lines which do not match our display criteria.
			var show = Boolean(showAll || (active && showActive) || (!active && showInactive) || (known && showKnown) || (!known && showUnknown) || (conformant && showConformant) || (!conformant && showNonconformant));
			if(!show){
				return;
			}
			
			var flags = [
				active ? 'active' : false,
				known ? 'known' : false,
				conformant ? 'conformant': false
			].filter(function onlyPositiveMarks(flagValue){
				return Boolean(flagValue);
			});
			var line = host.mac + ' ' + (host.lease_ip || host.mapping_ip) + ' ' + (host.lease_hostname || host.mapping_hostname) + ' [' + flags.join(',') + ']';
			// If dealing with a non-conformant host, advise the user what the proper address/hostname should be:
			if(active && known && !conformant){
				line += ' (mapping: ' + host.mac + ' ' + host.mapping_ip + ' ' + host.mapping_hostname + ')';
			}
			
			if(host.groups){
				line += ' (groups: ' + host.groups + ')';
			}
			
			if(active && known && conformant){
				return line.known;
			}
			if(!active){
				return line.inactive;
			}
			if(!known){
				return line.unknown;
			}
			if(!conformant){
				return line.warning;
			}
		}).filter(function skipEmptyLines(line){
			return typeof(line) === 'string' && line.length > 0;
		}).join('\n');
	});
};

InventoryCLI.prototype.map = function map(params){
	var argv = params._.slice();
	var mac = argv.shift();
	var ip = argv.shift();
	var hostname = argv.shift();
	if(!mac || !ip || !hostname){
		throw new Error('To map a host, all three values are required: <macaddr> <ipaddr> <hostname>', 1);
	}
	var comment = params.comment || '';
	var enabled = !(params.disabled);
	
	return this.db.addStaticMapping(mac, ip, hostname, enabled, comment);
};

InventoryCLI.prototype.unmap = function unmap(params){
	var argv = params._.slice();
	var mac = argv.shift();
	if(!mac){
		throw new Error('To unmap a host, a MAC address is required: <macaddr>', 1);
	}
	return this.db.deleteStaticMapping(mac);
};

module.exports.InventoryCLI = InventoryCLI;