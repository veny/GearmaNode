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
    common        = require('./common'),
    JS_CONSTANTS  = require('./job-server').CONSTANTS;


/**
 * @class Client
 * @classdesc A client for communicating with Gearman job servers.
 * @constructor
 * @augments events.EventEmitter
 * @mixes ServerManager
 *
 * @param options literal representing the client
 * @param {string} options.host hostname of single job server
 * @param {number} options.port port of single job server
 * @param {array} options.servers array of host,port pairs of multiple job servers
 * @param {string} [options.loadBalancing=Sequence] name of load balancing strategy
 * @param {number} [options.recoverTime=30000] delay in milliseconds before retrying the downed job server
 */
var Client = exports.Client = function(options) {
    var returned, clientOptions;

    options = options || {};
    clientOptions = { loadBalancing: options.loadBalancing, recoverTime: options.recoverTime };

    if (options.hasOwnProperty('loadBalancing')) { delete options.loadBalancing; }
    if (options.hasOwnProperty('recoverTime')) { delete options.recoverTime; }

    returned = common.verifyAndSanitizeOptions(clientOptions, { loadBalancing: 'Sequence', recoverTime: JS_CONSTANTS.DEFAULT_RECOVER_TIME });
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
    if (!common.isNumber(clientOptions.recoverTime)) { return new Error('option recoverTime is not number'); }
    this.loadBalancer.recoverTime = clientOptions.recoverTime;

    events.EventEmitter.call(this);
    Client.logger.log('info', 'client initialized with %d job server(s)', this.jobServers.length);
    Client.logger.log('debug', 'load balancing: strategy=%s, recoverTime=%d[ms]', clientOptions.loadBalancing, clientOptions.recoverTime);
}

// inheritance
util.inherits(Client, events.EventEmitter);
// mixes ServerManager
ServerManager.mixin(Client);

// static logger
Client.logger = winston.loggers.get('Client');


/**
 * Ends the client and all its associated resources, e.g. socket connections.
 * Sets property 'closed' to 'true'.
 * Removes all registered listeners on the object.
 *
 * @method
 * @fires Client#close
 * @returns {void} nothing
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
 * @param {string} name function name
 * @param {string|Buffer} payload opaque data that is given to the function as an argument
 * @param options literal representing additional job configuration
 * @param {boolean} options.background flag whether the job should be processed in background/asynchronous
 * @param {string} options.priority priority in job server queue, 'HIGH'|'NORMAL'|'LOW'
 * @param {string} options.unique unique identifiter for this job, the identifier is assigned by the client
 * @param {string} options.toStringEncoding if given received payload will be converted to String with this encoding, otherwise payload turned over as Buffer
 * @returns {Job} newly created job
 * @fires Job#submited
 */
Client.prototype.submitJob = function(name, payload, options) {
    var self = this, job, jobServer, packet, tryToSend, jsSendCallback;

    options = options || {};
    common.mixin({'name': name, 'payload': payload}, options);

    job = new Job(this, options);
    if (job instanceof Error) { return job; }
    job.processing = true;

    packet = protocol.encodePacket(job.getPacketType(), [job.name, (job.unique ? job.unique : ''), job.payload]);

    var jsSendCallback = function(err) {
        if (err instanceof Error) {
            Client.logger.log('warn', 'failed to submit job, server=%s, error:', jobServer.getUid(), err);
            tryToSend();
        } else {
            jobServer.jobsWaiting4Created.push(job); // add to queue of submited jobs waiting for confirmation
            job.jobServerUid = jobServer.getUid(); // store job server UID on job to later usage
            process.nextTick(function() { job.emit('submited'); });
            Client.logger.log('debug', 'job submited, name=%s, unique=%s', job.name, job.unique);
        }
    }

    tryToSend = function() {
        jobServer = self._getJobServer();
        if (!jobServer) { // problem escalated by '_getJobServer' on Client too
        	return job.emit('error', new Error('all job servers fail'));
        }

        jobServer.send(packet, jsSendCallback);
    }

    tryToSend();
    return job;
}


/**
 * @method
 * @access protected
 * @inheritDoc
 */
Client.prototype._response = function (jobServer, packetType, parsedPacket) { // #unit: not needed
    var packetCode = protocol.PACKET_CODES[packetType];
    var handle = parsedPacket[1];
    var job, jobStatus;
    var jobUid = jobServer.getUid() + '#' + handle;

    if (!this.jobs.hasOwnProperty(jobUid)) {
        this._unrecoverableError('unknown job, uid=' + jobUid);
        return;
    }
    job = this.jobs[jobUid];

    if (Client.logger.isLevelEnabled('debug')) {
        Client.logger.log('debug', 'response for client: type=%s, uid=%s', packetCode, job.getUid());
    }

    switch (packetType) {
    case protocol.PACKET_TYPES.JOB_CREATED:
        job.emit('created'); // trigger event

        break;

    case protocol.PACKET_TYPES.WORK_COMPLETE:
    case protocol.PACKET_TYPES.WORK_FAIL:
        job.processing = false;
        delete this.jobs[job.getUid()]; // remove it from table of submited & incomplete jobs

        job.response = parsedPacket[2];
        // encoding of payload; only for WORK_COMPLETE which have data
        if (packetType === protocol.PACKET_TYPES.WORK_COMPLETE && job.toStringEncoding) {
            job.response = job.response.toString(job.toStringEncoding);
        }

        job.emit(packetType === protocol.PACKET_TYPES.WORK_COMPLETE ? 'complete' : 'failed'); // trigger event
        break;

    case protocol.PACKET_TYPES.WORK_DATA:
    case protocol.PACKET_TYPES.WORK_WARNING:
        var data = parsedPacket[2];
        // encoding of data
        if (job.toStringEncoding) { data = data.toString(job.toStringEncoding); }
        job.emit(packetType == protocol.PACKET_TYPES.WORK_DATA ? 'workData' : 'warning', data); // trigger event
        break;

    case protocol.PACKET_TYPES.WORK_EXCEPTION:
        var data = parsedPacket[2];
        // encoding of data
        if (job.toStringEncoding) { data = data.toString(job.toStringEncoding); }
        job.processing = false;
        delete this.jobs[job.getUid()]; // remove it from table of submited & incomplete jobs
        job.emit('exception', data); // trigger event
        break;


    case protocol.PACKET_TYPES.STATUS_RES:
        jobStatus = {}
        jobStatus.known = '1' == parsedPacket[2];
        jobStatus.running = '1' == parsedPacket[3];
        jobStatus.percent_done_num = parsedPacket[4];
        jobStatus.percent_done_den = parsedPacket[5];
        if (Client.logger.isLevelEnabled('verbose')) {
            Client.logger.log('verbose', 'job status, handle=%s, known=%d, running=%d, num=%d, den=%d',
                handle, jobStatus.known, jobStatus.running, jobStatus.percent_done_num, jobStatus.percent_done_den);
        }

        job.emit('status', jobStatus); // trigger event
        break;

    case protocol.PACKET_TYPES.WORK_STATUS:
        jobStatus = {}
        jobStatus.percent_done_num = parsedPacket[2];
        jobStatus.percent_done_den = parsedPacket[3];
        if (Client.logger.isLevelEnabled('verbose')) {
            Client.logger.log('verbose', 'job status, handle=%s, num=%d, den=%d',
                handle, jobStatus.percent_done_num, jobStatus.percent_done_den);
        }

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
 * @method
 * @fires Client#error
 * @access protected
 * @inheritDoc
 */
Client.prototype._unrecoverableError = function (msg) { // #unit: not needed
    Client.logger.log('error', msg);
    this.emit('error', new Error(msg)); // trigger event
}


/**
 * Gets a job server according to load balancing strategy.
 *
 * @method
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
 * @class Job
 */
common.mixin({
    /**
     * Sends request to get status of a background job.
     * <br/>
     * See Gearman Documentation:
     * <br/>
     * <i>This is used by clients that have submitted a job with SUBMIT_JOB_BG to see if the
     * job has been completed, and if not, to get the percentage complete.</i>
     *
     * @method
     * @memberof Job
     * @fires Job#status when response successfully arrived
     * @returns {void} nothing
     */
    getStatus: function() {
        var jobServer, packet;

        if (!this.background) { return new Error('this is not a background job'); }
        if (!this.handle) { return new Error("no job's handle (no created job?)"); }
        if (!this.jobServerUid) { return new Error('no associated job server (never ever submited job?)'); }

        jobServer = this.clientOrWorker._getJobServerByUid(this.jobServerUid);
        if (!jobServer) { return new Error('job server not found by UID, uid=' + this.jobServerUid); }

        packet = protocol.encodePacket(protocol.PACKET_TYPES.GET_STATUS, [this.handle]);
        jobServer.send(packet);
    }
}, Job.prototype);
