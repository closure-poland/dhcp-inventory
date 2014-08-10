var when = require('when');
var nodefn = require('when/node');
var sqlite3 = require('sqlite3');

function Inventory(path){
	this.path = path;
	this.db = null;
}

/**
 * Open a database connection.
 */
Inventory.prototype.open = function open(){
	var self = this;
	return when.promise(function(resolve, reject){
		self.db = new sqlite3.Database(self.path, function(error){
			if(error){
				reject(error);
			}
			else{
				resolve();
			}
		});
	});
};

/**
 * Get an array of lease entries. These reflect actual IP addresses/hostnames granted by the DHCP server.
 */
Inventory.prototype.getHosts = function getHosts(){
	var db = this.db;
	var query = 'SELECT mac, lease_ip, lease_hostname, mapping_ip, mapping_hostname, GROUP_CONCAT(group_members."group") groups FROM' +
	' (SELECT leases.mac mac, leases.ip lease_ip, leases.hostname lease_hostname, mappings.ip mapping_ip, mappings.hostname mapping_hostname FROM leases LEFT OUTER JOIN mappings ON leases.mac = mappings.mac' +
	'  UNION SELECT mappings.mac mac, leases.ip lease_ip, leases.hostname lease_hostname, mappings.ip mapping_ip, mappings.hostname mapping_hostname FROM mappings LEFT OUTER JOIN leases ON mappings.mac = leases.mac' +
	' ) hosts LEFT OUTER JOIN group_members ON hosts.mapping_hostname = group_members.hostname GROUP BY mac, group_members.hostname, hosts.lease_ip, hosts.mapping_hostname, hosts.mapping_ip';
	return nodefn.call(db.all.bind(db), query, []);
};

/**
 * Add a lease entry.
 */
Inventory.prototype.addLease = function addLease(mac, ip, hostname){
	var db = this.db;
	var query = 'INSERT INTO leases (mac, ip, hostname) VALUES (?, ?, ?)';
	return nodefn.call(db.run.bind(db), query, [
		String(mac),
		String(ip),
		String(hostname)
	]);
};

/**
 * Add a static mapping so that the host may be assigned a defined IP and host name next time it asks for a lease.
 */
Inventory.prototype.addStaticMapping = function addStaticMapping(mac, ip, hostname, enabled, comment){
	var db = this.db;
	var query = 'INSERT INTO mappings (mac, ip, hostname, enabled, comment) VALUES (?, ?, ?, ?, ?)';
	return nodefn.call(db.run.bind(db), query, [
		String(mac),
		String(ip),
		String(hostname),
		Boolean(enabled),
		String(comment)
	]);
};

/**
 * Update a static mapping by MAC address.
 */
Inventory.prototype.updateStaticMapping = function updateStaticMapping(mac, ip, hostname, enabled, comment){
	var db = this.db;
	var query = 'UPDATE mappings SET ip = ?, hostname = ?, enabled = ?, comment = ? WHERE mac = ?';
	return when.promise(function(resolve, reject){
		db.run(query, [
			String(ip),
			String(hostname),
			Boolean(enabled),
			String(comment),
			String(mac)
		], function(error){
			if(error){
				return void reject(error);
			}
			if(this.changes < 1){
				return void reject(new Error('Could not update static mapping - no matching entry found for MAC address: ' + mac));
			}
			resolve();
		});
	});
};

/**
 * Delete a static mapping by MAC address.
 */
Inventory.prototype.deleteStaticMapping = function deleteStaticMapping(mac){
	var db = this.db;
	var query = 'DELETE FROM mappings WHERE mac = ?';
	return when.promise(function(resolve, reject){
		db.run(query, [
			String(mac)
		], function(error){
			if(error){
				return void reject(error);
			}
			if(this.changes < 1){
				return void reject(new Error('Could not delete static mapping - no matching entry found for MAC address: ' + mac));
			}
			resolve();
		});
	});
};

/**
 * Delete a lease.
 */
Inventory.prototype.deleteLease = function deleteLease(mac){
	var db = this.db;
	var query = 'DELETE FROM leases WHERE mac = ?';
	return when.promise(function(resolve, reject){
		db.run(query, [
			String(mac)
		], function verifyDeletedCount(error){
			if(error){
				return void reject(error);
			}
			if(this.changes < 1){
				return void reject(new Error('Could not remove lease - no matching entry found for MAC address: ' + mac));
			}
			resolve();
		});
	});
};

module.exports.Inventory = Inventory;