/*
 * This script represents class communicating as a client with Gearman job server.
 *
 * (C) 2013 Vaclav Sykora
 * Apache License, Version 2.0, http://www.apache.org/licenses/
 *
 */

var common = require('./common');


var Client = exports.Client = function(options) {
	pattern = { host: 'localhost', port: 2480, nodes: 'optional' }
	common.verifyAndSanitizeOptions(options, pattern);


	// fake nodes for single server
	if (!options.hasOwnProperty('nodes')) {
		options.nodes = {host: options.host, port: options.port};
	}

	this.options = options || {};
	this.jobServers = [];
};


Client.prototype.getJobServer = function() {

};