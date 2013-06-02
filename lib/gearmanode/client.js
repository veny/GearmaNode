/*
 * This script represents class communicating as a client with Gearman job server.
 *
 * (C) 2013 Vaclav Sykora
 * Apache License, Version 2.0, http://www.apache.org/licenses/
 *
 */

var util      = require('util'),
	winston   = require('winston'),
    common    = require('./common'),
    Job       = require('./job').Job;
    JobServer = require('./job-server').JobServer;

/**
 * *options*
 *    - loadBalancing name of load balancing strategy
 *    - keepAlive whether the connection should be long live
 */
var Client = exports.Client = function(options) {
	options = options || {};

    // static logger
    if (Client.logger === undefined) {
        Client.logger = winston.loggers.get('Client');
    }

	var pattern = { host: 'localhost', port: 4730, servers: 'optional' }
	var returned = common.verifyAndSanitizeOptions(options, pattern);
    if (returned instanceof Error) { return returned; }

	if (options.hasOwnProperty('servers')) {
		if (!util.isArray(options.servers)) {
			return new Error('servers: not an array');
		}
		if (options.servers.length === 0) {
			return new Error('servers: empty array');
		}
	} else { // fake servers if only single server given
		options.servers = [{ host: options.host, port: options.port }];
	}

	this.jobServers = [];
	var srv_pattern = { host: 'localhost', port: 4730 };
	for (var i = 0; i < options.servers.length; i ++) {
		common.verifyAndSanitizeOptions(options.servers[i], srv_pattern);
		var jobServer = new JobServer(options.servers[i]);
	    if (jobServer instanceof Error) { return jobServer; } // only paranoia

		this.jobServers.push(jobServer);
	}

	Client.logger.log('debug', 'created %s', this.toString());
};


Client.prototype.submitJob = function(jobname, payload, options) {
	options = options || {};
	options.name = jobname;
	options.payload = payload;
	var job = new Job(options);

 	var jobServer = this._getJobServer();
 	jobServer.connect(function(e) {console.log('CB ' + e)}); //XXX
 	jobServer.submit(job); //XXX cb
};


Client.prototype._getJobServer = function() {
	// TODO implement a load balancing strategy
	return this.jobServers[0];
};


Client.prototype.toString = function() {
	return 'Client(jobServers=' + util.inspect(this.jobServers) + ')';
}
