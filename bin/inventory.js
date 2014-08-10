#!/usr/local/bin/node

var parseArguments = require('minimist');

var Inventory = require('../Inventory').Inventory;
var InventoryCLI = require('../InventoryCLI').InventoryCLI;

var db = new Inventory(process.env.INVENTORY_DB || (__dirname + '/../inventory.db'));
var cli = new InventoryCLI(db);

var argv = parseArguments(process.argv.slice(2));

cli.init().then(function routeCommand(){
	var action = argv._.shift();
	if(cli[action]){
		return cli[action](argv);
	}
	else{
		throw new Error('No such action: ' + action + '. Available actions: list, map, unmap.', 1);
	}
}).then(function displayCommandOutput(output){
	if(typeof(output) !== 'undefined' && (typeof(output) !== 'string' || output.length > 0)){
		console.log(output);
	}
}).catch(function handleError(error){
	console.error('[ERROR]', error.message);
	process.exit(error.code || 111);
});