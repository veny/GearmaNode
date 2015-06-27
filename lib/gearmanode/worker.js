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
 * @fileoverview This script represents class communicating as a worker with Gearman job server.
 * @author vaclav.sykora@google.com (Vaclav Sykora)
 */

var util          = require('util'),
    events        = require('events'),
	winston       = require('winston'),
    ServerManager = require('./server-manager').ServerManager,
    Job           = require('./job').Job,
    protocol      = require('./protocol'),
    common        = require('./common'),
    JS_CONSTANTS  = require('./job-server').CONSTANTS;


/**
 * @class Worker
 * @classdesc A Worker for communicating with Gearman job servers.
 * @constructor
 * @augments events.EventEmitter
 * @mixes ServerManager
 *
 * @param options literal representing the client
 * @param {string} options.host hostname of single job server
 * @param {number} options.port port of single job server
 * @param {array} options.servers array of host,port pairs of multiple job servers
 * @param {boolean} options.withUnique flag whether a job will be grabbed with the client assigned unique ID
 * @param {number} [options.recoverTime=30000] delay in milliseconds before retrying the downed connection to job server
 * @param {number} [options.recoverLimit=3] how many attempts to retrying the downed connection to job server
 */
var Worker = exports.Worker = function(options) {
    var returned;

    options = options || {};
    workerOptions = { withUnique: options.withUnique, recoverTime: options.recoverTime, recoverLimit: options.recoverLimit };
    delete options.withUnique;
    delete options.recoverTime;
    delete options.recoverLimit;

    // VALIDATION
    returned = common.verifyAndSanitizeOptions(workerOptions, { withUnique: false, recoverTime: JS_CONSTANTS.DEFAULT_RECOVER_TIME, recoverLimit: 3 });
    if (returned instanceof Error) { return returned; }
    returned = common.verifyOptions(workerOptions, { withUnique: [true, false], recoverTime: 'madatory', recoverLimit: 'madatory' });
    if (returned instanceof Error) { return returned; }
    this.withUnique = workerOptions.withUnique;
    this.recoverTime = workerOptions.recoverTime;
    this.recoverLimit = workerOptions.recoverLimit;

    this._type = 'Worker';
    // call ServerManager initialization
    returned = this.initServers(options);
    if (returned instanceof Error) { return returned; }

    // table of functions successfully registered on a job server
    // in form: {'name': [func, options]}
    this.functions = {};

    events.EventEmitter.call(this);
    Worker.logger.log('info', 'worker initialized with %d job server(s)', this.jobServers.length);
};

// inheritance
util.inherits(Worker, events.EventEmitter);
// mixes ServerManager
ServerManager.mixin(Worker);

// static logger
Worker.logger = winston.loggers.get('Worker');


/**
 * Registers a function name with the job server and specifies a callback corresponding to that function.
 * It tries to connect to ALL job servers and fires 'error' if one registration fails.
 *
 * @method
 * @param {string} name name of a function
 * @param {Function} callback the function to be run when a job is received,  gets {@link Job} as parameter
 * @param options literal representing additional options
 * @param {number} options.timeout timeout value, the job server will mark the job as failed and notify any listening clients
 * @param {string} options.toStringEncoding if given received payload will be converted to String with this encoding, otherwise payload turned over as Buffer
 * @fires Worker#error
 * @returns {void} nothing
 */
Worker.prototype.addFunction = function(name, callback, options) {
    var jobServer, pattern, returned;
    if (!name) { return new Error('undefined function name'); }
    if (!(callback instanceof Function)) { return new Error('invalid callback (not a function)'); }

    // validate options
    options = options || {};
    pattern = { timeout: 'optional', toStringEncoding: 'optional' }
    returned = common.verifyOptions(options, pattern);
    if (returned instanceof Error) { return returned; }

    // validate encoding
    if (options.toStringEncoding && !Buffer.isEncoding(options.toStringEncoding)) {
        return new Error('invalid encoding: ' + options.toStringEncoding);
    }

    for (var i = 0; i < this.jobServers.length; i ++) { // TODO iterate only servers without any previous error
        jobServer = this.jobServers[i];
        if (options.hasOwnProperty('timeout')) {
            jobServer.send(protocol.encodePacket(protocol.PACKET_TYPES.CAN_DO_TIMEOUT, [name, options['timeout']]));
        } else {
            jobServer.send(protocol.encodePacket(protocol.PACKET_TYPES.CAN_DO, [name]));
        }
        this._preSleep(jobServer);
        this.functions[name] = [callback, options];
        Worker.logger.log('info', 'registered function name=%s on server uid=%s', name, jobServer.getUid());
    }
}


/**
 * Removes registration of given function from job server - worker is no longer
 * able to perform the given function.
 *
 * @method
 * @param {string} name name of the function to be removed
 * @returns {void} nothing
 */
Worker.prototype.removeFunction = function(name) {
    var jobServer;
    if (!name) { return new Error('undefined function name'); }
    if (!this.functions.hasOwnProperty(name)) { return new Error('function not registered, name=' + name); }
    for (var i = 0; i < this.jobServers.length; i ++) { // TODO iterate only servers without any previous error
        jobServer = this.jobServers[i];
        jobServer.send(protocol.encodePacket(protocol.PACKET_TYPES.CANT_DO, [name]));
        delete this.functions[name];
        Worker.logger.log('debug', 'unregistered function name=%s on server uid=%s', name, jobServer.getUid());
    }
}


/**
 * This is sent to notify the server that the worker is no longer able to do any functions
 * it previously registered with CAN_DO or CAN_DO_TIMEOUT.
 *
 * @method
 * @return {void} nothing
 */
Worker.prototype.resetAbilities = function() {
    var jobServer;
    for (var i = 0; i < this.jobServers.length; i ++) { // TODO iterate only servers without any previous error
        jobServer = this.jobServers[i];
        jobServer.send(protocol.encodePacket(protocol.PACKET_TYPES.RESET_ABILITIES));
    }
    Worker.logger.log('debug', 'RESET_ABILITIES on all servers');
}


/**
 * Sets the worker ID in a job server so monitoring and reporting
 * commands can uniquely identify the various workers.
 *
 * @method
 * @param {string} workerId the worker ID to be set in all job servers
 * @return {void} nothing
 */
Worker.prototype.setWorkerId = function(workerId) {
    var jobServer;

    // VALIDATION
    if (!common.isString(workerId)) { return new Error('worker ID not a string'); }
    if (workerId.length == 0) { return new Error('worker ID cannot be blank'); }

    this.workerId = workerId;

    for (var i = 0; i < this.jobServers.length; i ++) { // TODO iterate only servers without any previous error
        jobServer = this.jobServers[i];
        jobServer.send(protocol.encodePacket(protocol.PACKET_TYPES.SET_CLIENT_ID, [this.workerId]));
    }
    Worker.logger.log('debug', 'SET_CLIENT_ID on all servers, workerId=%s', this.workerId);
}


/**
 * Ends the worker and all its associated resources, e.g. socket connections.
 * Sets property 'closed' to 'true'.
 * Removes all registered listeners on the object.
 *
 * @method
 * @fires Worker#close
 * @returns {void} nothing
 */
Worker.prototype.close = function () {
    this.closed = true;

    this.closeServers();

    // clear registered functions
    for (var i in this.functions) {
        if (this.functions.hasOwnProperty(i)) {
            delete this.functions[i];
        }
    }

    this.emit('close'); // trigger event
    this.removeAllListeners();
}


/**
 * @method
 * @access protected
 * @inheritDoc
 */
Worker.prototype._response = function (jobServer, packetType, parsedPacket) { // #unit: not needed
    var job, funcAndOpts, fnRslt;

    switch (packetType) {
    case protocol.PACKET_TYPES.NOOP:
        jobServer.send(this.withUnique
            ? protocol.encodePacket(protocol.PACKET_TYPES.GRAB_JOB_UNIQ)
            : protocol.encodePacket(protocol.PACKET_TYPES.GRAB_JOB));
        break;
    case protocol.PACKET_TYPES.JOB_ASSIGN:
    case protocol.PACKET_TYPES.JOB_ASSIGN_UNIQ:
        var jobOpts = { handle: parsedPacket[1], name: parsedPacket[2], jobServerUid: jobServer.getUid() };
        if (packetType === protocol.PACKET_TYPES.JOB_ASSIGN) {
            jobOpts.payload = parsedPacket[3];
        } else {
            jobOpts.unique = parsedPacket[3];
            jobOpts.payload = parsedPacket[4];
        }
        job = new Job(this, jobOpts);
        //Object.freeze(job);
        // get the function and its options
        funcAndOpts = this._getFunction(job.name);
        // encoding of payload
        if (funcAndOpts[1].toStringEncoding) { job.payload = job.payload.toString(funcAndOpts[1].toStringEncoding); }
        fnRslt = funcAndOpts[0](job);
        Worker.logger.log('debug', 'function finished, name=%s, result=' + fnRslt, job.name);
        break;
    case protocol.PACKET_TYPES.NO_JOB:
        this._preSleep(jobServer);
        break;
    }
}


/**
 * Returns a human readable string representation of the object.
 *
 * @method
 * @returns {string} object description
 */
Worker.prototype.toString = function () { // #unit: not needed
    return 'Worker(jobServers=' + util.inspect(this.jobServers) + ')';
}


/**
 * Gets a registered function and its options or escalates an error if function not found.
 *
 * @method
 * @access private
 */
Worker.prototype._getFunction = function (name) { // #unit: not needed
    if (this.functions.hasOwnProperty(name)) {
        return this.functions[name];
    } else {
        Worker.logger.log('error', 'function not found in locale register, name=%s', name);
        this.emit('error', new Error('function not found in locale register, name=' + name));
    }
}


/**
 * Sends info to notify the server that the worker is about to sleep.
 *
 * @access private
 */
Worker.prototype._preSleep = function (jobServer) { // #unit: not needed
    jobServer.send(protocol.encodePacket(protocol.PACKET_TYPES.PRE_SLEEP));
}


/**
 * @method
 * @fires Worker#error
 * @access protected
 * @inheritDoc
 */
Worker.prototype._unrecoverableError = function (msg) { // #unit: not needed
    Worker.logger.log('error', msg);
    this.emit('error', new Error(msg)); // trigger event
}



/**
 * @class Job
 */
common.mixin({
    /**
     * Sends a notification to the server (and any listening clients) that the job completed successfully.
     *
     * @method
     * @memberof Job
     * @param {string|Buffer} data to be sent to client
     * @returns {void} nothing
     */
    workComplete: function (data) {
        data = data || '';
        this._sendAndClose(protocol.PACKET_TYPES.WORK_COMPLETE, [this.handle, data.toString()]);
    },
    /**
     * This is sent to update the client with data from a running job.
     * A worker should use this when it needs to send updates,
     * send partial results, or flush data during long running jobs.
     *
     * @method
     * @memberof Job
     * @param {string|Buffer} data to be sent to client
     * @returns {void} nothing
     */
    sendWorkData: function (data) {
        data = data || '';
        var jobServer = this.clientOrWorker._getJobServerByUid(this.jobServerUid);
        Worker.logger.log('debug', 'work data, handle=%s, data=%s', this.handle, data.toString());
        jobServer.send(protocol.encodePacket(protocol.PACKET_TYPES.WORK_DATA, [this.handle, data]));
    },
    /**
     * This is sent to update the server (and any listening clients) of the status of a running job.
     *
     * @method
     * @memberof Job
     * @param {number} numerator percent complete numerator
     * @param {number} denominator percent complete denominator
     * @returns {void} nothing
     */
    reportStatus: function (numerator, denominator) {
        if (!common.isNumber(numerator) || !common.isNumber(denominator)) {
            return new Error('numerator or denominator not a number');
        }
        var jobServer = this.clientOrWorker._getJobServerByUid(this.jobServerUid);
        jobServer.send(protocol.encodePacket(protocol.PACKET_TYPES.WORK_STATUS, [this.handle, numerator, denominator]));
    },
    /**
     * This is to notify the server (and any listening clients) that the job failed.
     * The job will be closed for additional processing in worker.
     *
     * @method
     * @memberof Job
     * @returns {void} nothing
     */
    reportError: function () {
        Worker.logger.log('warn', 'work failed, handle=%s', this.handle);
        this._sendAndClose(protocol.PACKET_TYPES.WORK_FAIL, [this.handle]);
    },
    /**
     * This is to notify the server (and any listening clients) that the job failed with the given exception.
     * The job will be closed for additional processing in worker.
     *
     * @deprecated https://bugs.launchpad.net/gearmand/+bug/405732
     * @method
     * @memberof Job
     * @param {object} data to be sent to client as text via #toString() invoked on the given object
     * @returns {void} nothing
     */
    reportException: function (data) {
        data = data || '[no more details provided by worker]';
        Worker.logger.log('warn', 'work failed with exception, handle=%s, exception=%s', this.handle, data.toString());
        this._sendAndClose(protocol.PACKET_TYPES.WORK_EXCEPTION, [this.handle, data]);
    },
    /**
     * This is sent to update the client with a warning.
     *
     * @method
     * @memberof Job
     * @param {object} data to be sent to client as text via #toString() invoked on the given object
     * @returns {void} nothing
     */
    reportWarning: function (data) {
        data = data || '[no more details provided by worker]';
        var jobServer = this.clientOrWorker._getJobServerByUid(this.jobServerUid);
        Worker.logger.log('warn', 'worker warning, handle=%s, msg=%s', this.handle, data.toString());
        jobServer.send(protocol.encodePacket(protocol.PACKET_TYPES.WORK_WARNING, [this.handle, data]));
    },

    /**
     * Re-usable helper method to send data to client and close this job.
     *
     * @method
     * @access private
     */
    _sendAndClose: function (packetType, packetData) {
        var jobServer = this.clientOrWorker._getJobServerByUid(this.jobServerUid);
        jobServer.send(protocol.encodePacket(packetType, packetData));
        this.clientOrWorker._preSleep(jobServer);
        this.close();
    }
}, Job.prototype);
