#!/usr/local/bin/node

var Inventory = require('../Inventory').Inventory;
var http = require('http');
var url = require('url');
var parseArguments = require('minimist');

var db = new Inventory(process.env.INVENTORY_DB || (__dirname + '/../inventory.db'));
var argv = parseArguments(process.argv.slice(2));
var httpPort = argv['http-port'] || 8067;
var httpAddress = argv['http-host'] || '0.0.0.0';

function isKnown(host){
	return typeof(host.mapping_ip) === 'string' && host.mapping_ip.length > 0;
};

function isActive(host){
	return typeof(host.lease_ip) === 'string' && host.lease_ip.length > 0;
}

db.open().then(function setupListener(){
	var server = http.createServer(function(req, res){
		if(req.method !== 'GET'){
			res.writeHead(400, 'This server only supports GET requests');
			return void res.end('Please use a GET request to reach the host listing.');
		}
		
		var pathInfo = url.parse(req.url, true);
		if(!pathInfo.query){
			pathInfo.query = {};
		}
		var useIP = (pathInfo.query.format === 'ip');
		var onlyActive = (pathInfo.query.active === 'true');
		
		db.getHosts().then(function generateHostGroups(hosts){
			var groups = {};
			
			function addGroupMember(group, host){
				if(!groups[group]){
					groups[group] = [];
				}
				groups[group].push(host);
			}
			
			// Only export known (mapped) hosts as JSON. Also apply an "active" filter if requested.
			if(onlyActive){
				hosts = hosts.filter(isActive);
			}	
			hosts.filter(isKnown).forEach(function processHostEntry(host){
				var hostAddress;
				if(useIP){
					hostAddress = host.lease_ip || host.mapping_ip;
				}
				else{
					hostAddress = host.lease_hostname || host.mapping_hostname;
				}
				if(host.groups){
					host.groups.split(',').forEach(function(currentGroup){
						addGroupMember(currentGroup, hostAddress);
					});
				}
			});
			
			return groups;
		}).then(function sendHostGroups(groups){
			res.writeHead(200, 'OK, will send host info');
			res.end(JSON.stringify(groups));
		}).catch(function(error){
			res.writeHead(500, 'Server-side inventory error');
			res.end('Error: ' + String(error));
		});
	});
	server.listen(httpPort, httpAddress);
	var myURL = 'http://' + httpAddress + ':' + httpPort + '/';
	console.info('# Listening on ' + myURL);
	console.info('On your client, you may want to try the following:');
	console.info('* ' + myURL + '?format=ip \t\t\t Only use IP addresses instead of hostnames');
	console.info('* ' + myURL + '?active=true \t\t\t Only return active hosts (for which leases are present)');
	console.info('* ' + myURL + '?format=ip&active=true \t\t\t Online hosts by IP address');
});