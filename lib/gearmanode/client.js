// Copyright 2013 The GearmaNode Library Authors. All Rights Reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS-IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

/*
 * @fileoverview This script represents class communicating as a client with Gearman job server.
 * @author vaclav.sykora@google.com (Vaclav Sykora)
 */

var util          = require('util'),
    events        = require('events'),
    winston       = require('winston'),
    ServerManager = require('./server-manager').ServerManager,
    Job           = require('./job').Job,
    lb            = require('./load-balancing'),
    protocol      = require('./protocol'),
    common        = require('./common');


/**
 * @class Client
 * @classdesc A client for communicating with Gearman job servers.
 * @constructor
 * @augments events.EventEmitter
 *
 * @param options literal representing the client
 * @param {string} options.host hostname of single job server
 * @param {number} options.port port of single job server
 * @param {array} options.servers array of host,port pairs of multiple job servers
 * @param {string} options.loadBalancing name of load balancing strategy
 */
var Client = exports.Client = function(options) {
    var returned, clientOptions;

    options = options || {};
    clientOptions = { loadBalancing: options.loadBalancing };
    if (options.hasOwnProperty('loadBalancing')) { delete options.loadBalancing; }

    returned = common.verifyAndSanitizeOptions(clientOptions, { loadBalancing: 'Sequence' });
    if (returned instanceof Error) { return returned; }

    this._type = 'Client';
    // call ServerManager initialization
    returned = this.initServers(options);
    if (returned instanceof Error) { return returned; }

	// Table of Jobs submited by this client.
	// A Job is inserted after JOB_CREATED packet.
	// A Job is removed:
	// * a non-background job after WORK_COMPLETE
	// * a background job by call of Job#close()
	this.jobs = {};

    // load balancing
    switch (clientOptions.loadBalancing) {
        case 'RoundRobin':
            this.loadBalancer = new lb.RoundRobin(this.jobServers.length);
            break;
        case 'Sequence':
            this.loadBalancer = new lb.Sequence(this.jobServers.length);
            break;
        default:
            return new Error('unknow load balancing strategy: ' + clientOptions.loadBalancing);
    }

    events.EventEmitter.call(this);
    Client.logger.log('info', 'client initialized with %d job server(s)', this.jobServers.length);
}

// inheritance
util.inherits(Client, events.EventEmitter);
/** @mixes ServerManager */
ServerManager.mixin(Client);

// static logger
Client.logger = winston.loggers.get('Client');


/**
 * Ends the client and all its associated resources, e.g. socket connections.
 * Sets property 'closed' to 'true'.
 * Removes all registered listeners on the object.
 *
 * @fires Client#close
 * @method
 */
Client.prototype.close = function () {
    this.closed = true;

    this.closeServers();

    // clear submited & incomplete jobs
    for (var i in this.jobs) {
        if (this.jobs.hasOwnProperty(i)) {
            this.jobs[i].close();
            delete this.jobs[i];
        }
    }

    this.emit('close'); // trigger event
    this.removeAllListeners();
}


/**
 * Submits given job to a job server according to load balancing strategy.
 *
 * @method
 * @param options literal representing the job
 * @param {string} options.name function name
 * @param {string} options.payload opaque data that is given to the function as an argument
 * @param {string} options.unique unique identifiter for this job, the identifier is assigned by the client, Optional
 * @param {string} options.encoding encoding to use, Optional
 * @returns {Job} newly created job
 */
Client.prototype.submitJob = function(options) {
    var jobServer, packet;

	var job = new Job(this, options);
	if (job instanceof Error) { return job; }
    job.processing = true;

    jobServer = this._getJobServer();
    if (!jobServer) { return new Error('failed to obtain job server'); }

    jobServer.jobsWaiting4Created.push(job); // add to queue of submited jobs waiting for confirmation
    job.jobServerUid = jobServer.getUid(); // store job server UID on job to later usage

    packet = protocol.encodePacket(job.getPacketType(), job.encoding,
        [job.name, (job.unique ? job.unique : ''), job.payload]);

    jobServer.send(packet);
    Client.logger.log('debug', 'job submited, name=%s, unique=%s', job.name, job.unique);
    return job;
}


/**
 * @inheritDoc
 */
Client.prototype._response = function (jobServer, packetType, parsedPacket) { // #unit: not needed
    var packetCode = protocol.PACKET_CODES[packetType];
    var handle = parsedPacket[1];
    var job, jobStatus;

    if (!this.jobs.hasOwnProperty(handle)) {
        this._unrecoverableError('unknown job, handle=' + handle);
        return;
    }
    job = this.jobs[handle];

    Client.logger.log('debug', 'response for client: type=%s, handle=%s', packetCode, handle);

    switch (packetType) {
    case protocol.PACKET_TYPES.JOB_CREATED:
        job.emit('created'); // trigger event

        break;

    case protocol.PACKET_TYPES.WORK_COMPLETE:
    case protocol.PACKET_TYPES.WORK_FAIL:
        job.processing = false;
        delete this.jobs[handle]; // remove it from table of submited & incomplete jobs

        job.response = parsedPacket[2];
        job.emit(packetType === protocol.PACKET_TYPES.WORK_COMPLETE ? 'complete' : 'failed'); // trigger event
        break;

    case protocol.PACKET_TYPES.WORK_EXCEPTION:
        job.processing = false;
        delete this.jobs[handle]; // remove it from table of submited & incomplete jobs
        job.emit('exception', parsedPacket[2]); // trigger event
        break;


    case protocol.PACKET_TYPES.STATUS_RES:
        jobStatus = {}
        jobStatus.known = '1' == parsedPacket[2];
        jobStatus.running = '1' == parsedPacket[3];
        jobStatus.percent_done_num = parsedPacket[4];
        jobStatus.percent_done_den = parsedPacket[5];
        Client.logger.log('verbose', 'job status, handle=%s, known=%d, running=%d, num=%d, den=%d',
            handle, jobStatus.known, jobStatus.running, jobStatus.percent_done_num, jobStatus.percent_done_den);

        job.emit('status', jobStatus); // trigger event
        break;

    case protocol.PACKET_TYPES.WORK_STATUS:
        jobStatus = {}
        jobStatus.percent_done_num = parsedPacket[2];
        jobStatus.percent_done_den = parsedPacket[3];
        Client.logger.log('verbose', 'job status, handle=%s, num=%d, den=%d',
            handle, jobStatus.percent_done_num, jobStatus.percent_done_den);

        job.emit('status', jobStatus); // trigger event
        break;
    }
}


/**
 * Returns a human readable string representation of the object.
 *
 * @method
 * @returns {string} object description
 */
Client.prototype.toString = function() { // #unit: not needed
	return 'Client(jobServers=' + util.inspect(this.jobServers) + ')';
}


/**
 * Gets a job server according to load balancing strategy.
 *
 * @access private
 */
Client.prototype._getJobServer = function() {
    var idx = this.loadBalancer.nextIndex();
    if (idx === null) {
        this._unrecoverableError('failed to obtain job server from load balancer (all servers invalid?)');
        return null;
    }
	return this.jobServers[idx];
}


/**
 * @inheritDoc
 * @access private
 */
Client.prototype._unrecoverableError = function (msg) { // #unit: not needed
    Client.logger.log('error', msg);
    this.emit('error', new Error(msg)); // trigger event
}



common.mixin({
    /**
     * Sends request to get status of a background job.
     * Event 'status' will be emitted in response in case of success.
     *
     * See Gearman Documentation:
     * --------------------------
     * This is used by clients that have submitted a job with SUBMIT_JOB_BG to see if the
     * job has been completed, and if not, to get the percentage complete.
     */
    getStatus: function() {
        var jobServer, packet;

        if (!this.background) { return new Error('this is not a background job'); }
        if (!this.handle) { return new Error("no job's handle (no created job?)"); }
        if (!this.jobServerUid) { return new Error('no associated job server (never ever submited job?)'); }

        jobServer = this.clientOrWorker._getJobServerByUid(this.jobServerUid);
        if (!jobServer) { return new Error('job server not found by UID, uid=' + this.jobServerUid); }

        packet = protocol.encodePacket(protocol.PACKET_TYPES.GET_STATUS, 'ascii', [this.handle]);
        jobServer.send(packet);
    }
}, Job.prototype);
