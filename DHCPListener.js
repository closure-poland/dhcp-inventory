function DHCPListener(inventory){
	this.inventory = inventory;
}

DHCPListener.prototype.init = function init(){
	return this.inventory.open();
};

DHCPListener.prototype.add = function add(args, env){
	var mac = args.shift();
	var ip = args.shift();
	var hostname = args.shift();
	
	return this.inventory.addLease(mac, ip, hostname);
};

DHCPListener.prototype.del = function del(args, env){
	var mac = args.shift();
	
	return this.inventory.deleteLease(mac);
};

DHCPListener.prototype.old = function old(args, env){
	var mac = args.shift();
	var ip = args.shift();
	var hostname = args.shift();
	
	return this.inventory.addLease(mac, ip, hostname).catch(/SQLITE_CONSTRAINT/, function(error){
		// Do nothing, since the lease was already in the inventory. It is assumed that we had placed it there.
		//  Note that, in case we missed some updates, we could choose to update the lease.
		//TODO: Implement lease updates when a collision occurs, to make sure that we are restart-safe even in case of dnsmasq config weirdness (i.e. missed updates).
	});
};

module.exports.DHCPListener = DHCPListener;