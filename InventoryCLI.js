var colors = require('colors');
var when = require('when');
var nodefn = require('when/node');
var fs = nodefn.liftAll(require('fs'));
var child_process = require('child_process');

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
}

function isActive(host){
	return typeof(host.lease_ip) === 'string' && host.lease_ip.length > 0;
}

function isConformant(host){
	return isKnown(host) && isActive(host) && host.lease_ip === host.mapping_ip && host.lease_hostname === host.mapping_hostname;
}

function intersects(setA, setB){
	if(!setA || !setB){
		return false;
	}
	if(typeof(setA) === 'string'){
		setA = setA.split(',');
	}
	if(typeof(setB) === 'string'){
		setB = setB.split(',');
	}
	return setA.some(function(valueA){
		return setB.some(function(valueB){
			return valueA === valueB;
		});
	});
}

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
	var limitGroups = (params.group ? params.group.split(',') : null);
	// If no criteria specified, just show all entry states.
	var showAll = !(showActive || showInactive || showKnown || showUnknown || limitGroups);
	
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
			var show = Boolean(showAll || (active && showActive) || (!active && showInactive) || (known && showKnown) || (!known && showUnknown) || (conformant && showConformant) || (!conformant && showNonconformant) || (!limitGroups || intersects(limitGroups, host.groups)));
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

InventoryCLI.prototype.group_add = function group_add(params){
	var argv = params._.slice();
	var group = argv.shift();
	var hostname = argv.shift();
	if(!group || !hostname){
		throw new Error('To add a group member, two values are required: <group> <hostname>');
	}
	return this.db.addGroupMember(group, hostname);
};

InventoryCLI.prototype.group_remove = function group_remove(params){
	var argv = params._.slice();
	var group = argv.shift();
	var hostname = argv.shift();
	if(!group || !hostname){
		throw new Error('To remove a group member, two values are required: <group> <hostname>');
	}
	return this.db.deleteGroupMember(group, hostname);
};

InventoryCLI.prototype.export = function export_(params){
	var db = this.db;
	var argv = params._.slice();
	var type = params.type || 'dnsmasq';
	var apply = Boolean(params.apply) && !(params.stdout);
	if(params.apply && params.stdout){
		console.warn('[WARN] --stdout and --apply may not be used together. Use --outfile instead of --stdout or restart the service manually.');
	}
	
	var exportMechanisms = {
		dnsmasq: function dnsmasq(){
			var target = params.outfile || '/etc/dnsmasq.d/dhcp-inventory.conf';
			if(params.stdout){
				target = null;
			}
			// Gather the entries:
			return db.getHosts().then(function generateHostDirectives(hostList){
				// Now that we have the full host list, choose the statically-mapped ones:
				hostList = hostList.filter(function onlyKnown(host){
					return isKnown(host);
				});
				// Build configuration directives out of them:
				var directives = hostList.map(function buildHostLine(host){
					//NOTE: For now, there is no support for host groups in this export handler. Thus, "set:" is not generated based on groups.
					return 'dhcp-host=' + host.mac + ',' + host.mapping_ip + ',' + host.mapping_hostname;
				});
				return [
					'# Generated by dhcp-inventory (inventory.js) on ' + (new Date()).toISOString(),
					'# To refresh, use `inventory.js export --type dnsmasq`. Restart the service afterwards.'
				].concat(directives).join('\n');
			}).then(function writeOutHostDirectives(output){
				// We have generated the output - save it.
				// Bypass the file-writing logic if the user has requested that the file be written to standard output. This also forcibly disregards the --apply option.
				if(!target){
					return output;
				}
				
				// Write the file, adding a trailing new line.
				return fs.writeFile(target, output + '\n');
			}).then(function restartService(){
				// Bypass service restart if not requested.
				if(!apply){
					return;
				}
				return when.promise(function(resolve, reject){
					var commandArguments = ['service', 'dnsmasq', 'force-reload'];
					if(process.getuid() !== 0){
						commandArguments.unshift('sudo');
					}
					var commandName = commandArguments.shift();
					child_process.spawn(commandName, commandArguments, {
						stdio: 'inherit'
					}).once('error', reject).once('close', function(code){
						if(code === 0){
							resolve();
						}
						else{
							reject(new Error('Got exit code ' + code + ' when trying to call `service dnsmasq force-reload`.', 11));
						}
					});
				});
			});
		}
	};
	
	if(!exportMechanisms[type]){
		throw new Error('Export mechanism unknown: ' + type + '. Available mechanisms: ' + Object.keys(exportMechanisms).join(', ') + '.', 1);
	}
	return exportMechanisms[type]();
};

module.exports.InventoryCLI = InventoryCLI;