/*
 * This script represents class communicating as a client with Gearman job server.
 *
 * (C) 2013 Vaclav Sykora
 * Apache License, Version 2.0, http://www.apache.org/licenses/
 *
 */

var util    = require('util'),
	net 	= require('net'),
    common  = require('./common');


var Client = exports.Client = function(options) {
	options = options || {};

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
		this.jobServers.push(options.servers[i]);
	}
};


Client.prototype.getConnection = function (callback) {
	if (callback === undefined) { return new Error('no callback'); }
    var conn = this.connection,
        client = this;

    if (!conn) {
    	var jobServer = this._getJobServer();
        conn = net.createConnection(jobServer.port, jobServer.host);
		conn.on('error', function (err) {
// console.log('!!!!!!!!!!! ' + util.inspect(data));
			callback(err);
		});

        conn.on('data', function (data) {
            decodedData = packet.decode(data);
            var type = decodedData.type;
            // debug("Recieved:", data);
            if (type in responses) { responses[type](data, client); }
        });
    }

    this.connection = conn;
    return conn;
};


Client.prototype.submitJob = function(jobname, payload, options) {
	var job = new Job(options);
    job.submit();
    return job;
};


Client.prototype._getJobServer = function() {
	return this.jobServers[0];
};


Client.prototype.toString = function() {
	var rslt = 'Client(jobServers=' + util.inspect(this.jobServers);
	return rslt + ')';
}
