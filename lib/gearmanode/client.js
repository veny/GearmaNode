/*
 * This script represents class communicating as a client with Gearman job server.
 *
 * (C) 2013 Vaclav Sykora
 * Apache License, Version 2.0, http://www.apache.org/licenses/
 *
 */

var util       = require('util'),
    events     = require('events'),
	winston    = require('winston'),
    ServerMate = require('./server-mate').ServerMate,
    Job        = require('./job').Job,
    protocol   = require('./protocol');


/**
 * *options*
 *    * loadBalancing name of load balancing strategy
 */
var Client = exports.Client = function(options) {
    var i;

    // call super-constructor
    var mate = ServerMate.call(this, options);
    if (mate instanceof Error) { return mate; }

	// Table of Jobs submited by this client.
	// A Job is inserted after JOB_CREATED packet.
	// A Job is removed:
	// * a non-background job after WORK_COMPLETE
	// * a background job by call of Job#close()
	this.jobs = {};

    events.EventEmitter.call(this);
    Client.logger.log('info', 'client initialized with %d job server(s)', this.jobServers.length);
};

// inheritance
util.inherits(Client, ServerMate);
util.inherits(Client, events.EventEmitter);

// static logger
Client.logger = winston.loggers.get('Client');


/**
 * Submits given job to a job server according to load balancing strategy.
 *
 * *callback(err,job)* called as
 *     * error callback when job invalid defined or connection fails
 *     * success callback when the job sent/submited over socket with new Job instance as parameter
 */
Client.prototype.submitJob = function(options, callback) {
	var job, jobServer, packet, cb;

	if (!(callback instanceof Function)) { return new Error('invalid callback (not a function)'); }

	job = new Job(options);
	if (job instanceof Error) {
		callback(job, null);
		return;
	}

    jobServer = this._getJobServer();
    packet = protocol.encodePacket(job.getPacketType(), job.encoding,
        [job.name, (job.unique ? job.unique : ''), job.payload]);

    cb = function (err) {
        if (err instanceof Error) {
            callback(err, job);
            return;
        }

        job.processing = true;
        job.jobServerUid = jobServer.getUid(); // store job server UID on job to later usage
        jobServer.jobsWaiting4Created.push(job); // add to queue of submited jobs waiting for confirmation
        Client.logger.log('debug', 'job submited, name=%s, unique=%s', job.name, job.unique);
        callback(null, job);
    }

    jobServer.send(packet, job.encoding, cb);
}


/**
 * Gets status of given background job.
 *
 * See Gearman Documentation:
 * --------------------------
 * This is used by clients that have submitted a job with SUBMIT_JOB_BG to see if the
 * job has been completed, and if not, to get the percentage complete.
 */
Client.prototype.getStatus = function(job, callback) { // #unit: TODO test it
	var jobServer, packet;

    if (!(callback instanceof Function)) { return new Error('invalid callback (not a function)'); }

    if (!job.background) {
        callback(new Error('this is not a background job'));
        return;
    }
    if (!job.handle) {
        callback(new Error("no job's handle (no created job?)"));
        return;
    }
    if (!job.jobServerUid) {
        callback(new Error('no associated job server (never ever submited job?)'));
        return;
    }

    jobServer = this._getJobServerByUid(job.jobServerUid);
    if (!jobServer) { return new Error('job server not found by UID, uid=' + job.jobServerUid); }

    packet = protocol.encodePacket(protocol.PACKET_TYPES.GET_STATUS, 'ascii', [job.handle]);

    jobServer.send(packet, 'ascii', callback);
}


/**
 * Ends the client and all its associated resources, e.g. socket connections.
 * Sets property 'closed' to 'true'.
 */
Client.prototype.close = function () {
	var i;
    for (i = 0; i < this.jobServers.length; i ++) {
    	this.jobServers[i].disconnect();
    }

    this.closed = true;

    // clear submited & incomplete jobs
    for (i in this.jobs) {
        if (this.jobs.hasOwnProperty(i)) {
            this.jobs[i].close();
            delete this.jobs[i];
        }
    }
}


/**
 * Returns a human readable string representation of the object.
 */
Client.prototype.toString = function() { // #unit: not needed
	return 'Client(jobServers=' + util.inspect(this.jobServers) + ')';
}


/**
 * Gets a job server according to load balancing strategy.
 */
Client.prototype._getJobServer = function() { // #unit: TODO test it
	// TODO implement a load balancing strategy
	return this.jobServers[0];
};


/**
 * Gets a JobServer object according to given UID or 'null' if not found.
 */
Client.prototype._getJobServerByUid = function (uid) { // #unit: not needed
    var i;
    for (i = 0; i < this.jobServers.length; i ++) {
        if (uid == this.jobServers[i].getUid()) {
            return this.jobServers[i];
        }
    }
    return null;
}
