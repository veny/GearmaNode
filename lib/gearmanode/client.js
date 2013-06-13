/*
 * This script represents class communicating as a client with Gearman job server.
 *
 * (C) 2013 Vaclav Sykora
 * Apache License, Version 2.0, http://www.apache.org/licenses/
 *
 */

var util      = require('util'),
    events    = require('events'),
	winston   = require('winston'),
    common    = require('./common'),
    Job       = require('./job').Job;
    JobServer = require('./job-server').JobServer;


/**
 * *options*
 *    * loadBalancing name of load balancing strategy
 */
var Client = exports.Client = function(options) {
    // static logger
    if (Client.logger === undefined) {
        Client.logger = winston.loggers.get('Client');
    }

	options = options || {};

    // VALIDATION
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

    events.EventEmitter.call(this);
};

Client.prototype.__proto__ = events.EventEmitter.prototype;
// client emits events based on life cycle
//util.inherits(Client, EventEmitter);


/**
 * Submits given job to a job server according to load balancing strategy.
 *
 * *callback(err,job)* called as
 *     * error callback when job invalid defined or connection fails
 *     * success callback when the job sent/submited over socket with new Job instance as parameter
 */
Client.prototype.submitJob = function(options, callback) { // #unit: TODO test it
	var job, jobServer, connectCallback, submit;
	var self = this;

	if (!(callback instanceof Function)) { return new Error('invalid callback (not a function)'); }

	job = new Job(options);
	if (job instanceof Error) {
		callback(job, null);
		return;
	}

	// invoked async after connection established
    connectCallback = function(connectErr) {
        if (connectErr instanceof Error) {
            callback(connectErr, job); // connection failed
        } else {
	        self.emit('connect'); // trigger event
	        jobServer.client = self; // TODO this is a dirty solution that JobServer#processData can emit 'error' on Client, refactor it
	        submit();
        }
    };

	// invoked to submit a job on open connection
	submit = function () {
    	jobServer.submit(job, function (submitErr) {
    		if (!(submitErr instanceof Error)) {
      			self.emit('submit', jobServer.jobsWaiting4Created.length) // trigger event
	   		}
			callback(submitErr, job)
    	});

	}

 	jobServer = this._getJobServer();
    if (!jobServer.connected) {
        Client.logger.log('debug', 'unconnected job server:', jobServer.toString('minimal'));
        jobServer.connect(connectCallback);
    } else {
        submit();
    }
};


Client.prototype.end = function () { // #unit: TODO test it
	var i;
    for (i = 0; i < this.jobServers.length; i ++) {
    	this.jobServers[i].disconnect();
    }
}


/**
 * Returns a human readable string representation of the object.
 */
Client.prototype.toString = function() { // #unit: not needed
	return 'Client(jobServers=' + util.inspect(this.jobServers) + ')';
}


Client.prototype._getJobServer = function() { // #unit: TODO test it
	// TODO implement a load balancing strategy
	return this.jobServers[0];
};
