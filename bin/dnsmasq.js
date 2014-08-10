#!/usr/local/bin/node

var Inventory = require('../Inventory').Inventory;
var DHCPListener = require('../DHCPListener').DHCPListener;

var db = new Inventory(__dirname + '/../inventory.db');
var listener = new DHCPListener(db);

var args = Array.prototype.slice.call(process.argv, 2);
var action = args.shift();

listener.init().then(function(){
	if(listener[action]){
		return listener[action](args.slice(), process.env);
	}
}).catch(function(error){
	console.error('[ERROR]', error.message);
	process.exit(error.code || 111);
});