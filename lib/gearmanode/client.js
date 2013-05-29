/*
 * This script represents class communicating as a client with Gearman job server.
 *
 * (C) 2013 Vaclav Sykora
 * Apache License, Version 2.0, http://www.apache.org/licenses/
 *
 */

var util    = require('util'),
    common  = require('./common');


var Client = exports.Client = function(options) {
	var pattern = { host: 'localhost', port: 2480, servers: 'optional' }
	common.verifyAndSanitizeOptions(options, pattern);

	if (options.hasOwnProperty('servers')) {
		if (!util.isArray(options.servers)) {
			throw 'servers not in an array';
		}
	} else { // fake servers if only single server given
		options.servers = [{ host: options.host, port: options.port }];
	}

	this.jobServers = [];
	var srv_pattern = { host: 'optional', port: 'optional' };
	for (var i = 0; i < options.servers.length; i ++) {
		common.verifyOptions(options.servers[i], srv_pattern);
		this.jobServers.push(options.servers[i]);
	}
};


Client.prototype.toString = function() {
	var rslt = 'Client(jobServers=' + util.inspect(this.jobServers);
	return rslt + ')';
}


Client.prototype.getJobServer = function() {

};