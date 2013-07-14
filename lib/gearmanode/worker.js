/*
 * This script represents class communicating as a worker with Gearman job server.
 *
 * (C) 2013 Vaclav Sykora
 * Apache License, Version 2.0, http://www.apache.org/licenses/
 *
 */

var util          = require('util'),
    events        = require('events'),
	winston       = require('winston'),
    ServerManager = require('./server-manager').ServerManager,
    Job           = require('./job').Job,
    protocol      = require('./protocol'),
    common        = require('./common');


/**
 * *options*
 *    * host - hostname of single job server
 *    * port - port of single job server
 *    * servers - array of host,port pairs of multiple job servers
 */
var Worker = exports.Worker = function(options) {
    var returned;

    this._type = 'Worker';
    // call ServerManager initialization
    returned = this.initServers(options);
    if (returned instanceof Error) { return returned; }

    // table of functions successfully registered on a job server
    // {'name': [func, options]}
    this.functions = {};

    events.EventEmitter.call(this);
    Worker.logger.log('info', 'worker initialized with %d job server(s)', this.jobServers.length);
};

// inheritance
util.inherits(Worker, events.EventEmitter);
// mixin
ServerManager.mixin(Worker);

// static logger
Worker.logger = winston.loggers.get('Worker');


/**
 * Registers a function name with the job server and specifies a callback corresponding to that function.
 *
 * *name* name of a function
 * *callback(job) - the function to be run when a job is received,  gets one parameter
 *     *job - interface to turn over assigned job and report job information to the job server
 *        *sendWorkComplete - sends a notification to the server (and any listening clients) that the job completed successfully.
 *        *reportStatus - reports job's status to the job server
 *        *reportWarning - sends a warning explicitly to the job server
 *        *reportError - to indicate that the job failed
 *        *sendData - send data before job completes
 *        *name - name of the function (getter)
 *        *jobServerUid - getter
 *        *handle - getter
 *        *payload - received data (Buffer or String)
 * *options*
 *    *timeout - the timeout value, the job server will mark the job as failed and notify any listening clients (optional)
 *    *withUnique - flag whether a job will be grabbed with the client assigned unique ID - TODO
 *    *toStringEncoding - if given received payload will be converted to String with this encoding, otherwise payload turned over as Buffer
 */
Worker.prototype.addFuntion = function(name, callback, options) {
    var jobServer;
    if (!name) { return new Error('undefined function name'); }
    if (!(callback instanceof Function)) { return new Error('invalid callback (not a function)'); }
    options = options || {};

    for (var i = 0; i < this.jobServers.length; i ++) { // TODO iterate only servers without any previous error
        jobServer = this.jobServers[i];
        this._sendWithJobServer(jobServer, protocol.encodePacket(protocol.PACKET_TYPES.CAN_DO, 'ascii', [name]));
        this._preSleep(jobServer);
        this.functions[name] = [callback, options];
        Worker.logger.log('debug', 'registered function name=%s on server uid=%s', name, jobServer.getUid());
    }
}


/**
 * Removes registration of given function from job server - worker is no longer
 * able to perform the given function.
 */
Worker.prototype.removeFuntion = function(name) {
    var jobServer;
    if (!name) { return new Error('undefined function name'); }
    if (!this.functions.hasOwnProperty(name)) { return new Error('function not registered, name=' + name); }
    for (var i = 0; i < this.jobServers.length; i ++) { // TODO iterate only servers without any previous error
        jobServer = this.jobServers[i];
        this._sendWithJobServer(jobServer, protocol.encodePacket(protocol.PACKET_TYPES.CANT_DO, 'ascii', [name]));
        delete this.functions[name];
        Worker.logger.log('debug', 'unregistered function name=%s on server uid=%s', name, jobServer.getUid());
    }
}


/**
 * Ends the worker and all its associated resources, e.g. socket connections.
 * Sets property 'closed' to 'true'.
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
}


/**
 * Invoked when a job server response is delivered.
 */
Worker.prototype.response = function (jobServer, packetType, parsedPacket) { // #unit: not needed
    var job, funcAndOpts, fnRslt;

    switch (packetType) {
    case protocol.PACKET_TYPES.NOOP:
        this._sendWithJobServer(jobServer, protocol.encodePacket(protocol.PACKET_TYPES.GRAB_JOB));
        break;
    case protocol.PACKET_TYPES.JOB_ASSIGN:
        job = new Job(this,
            { handle: parsedPacket[1], name: parsedPacket[2], payload: parsedPacket[3], jobServerUid: jobServer.getUid() });
        funcAndOpts = this.getFunction(job.name);
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
 */
Worker.prototype.toString = function () { // #unit: not needed
    return 'Worker(jobServers=' + util.inspect(this.jobServers) + ')';
}


/**
 * Send a packet with given job server.
 */
Worker.prototype._sendWithJobServer = function (jobServer, buffer) { // #unit: not needed
    var self = this;
    var cb = function (err) {
        if (err instanceof Error) {
            Worker.logger.log('error', util.inspect(err));
            self.emit('error', err);
        }
    }
    jobServer.send(buffer, cb);
}


/**
 * Gets a registered function and its options or escalates an error if function not found.
 */
Worker.prototype.getFunction = function (name) { // #unit: not needed
    if (this.functions.hasOwnProperty(name)) {
        return this.functions[name];
    } else {
        Worker.logger.log('error', 'function not found in locale register, name=%s', name);
        this.emit('error', new Error('function not found in locale register, name=' + name));
    }
}


/**
 * Sends info to notify the server that the worker is about to sleep.
 */
Worker.prototype._preSleep = function (jobServer) { // #unit: not needed
    this._sendWithJobServer(jobServer, protocol.encodePacket(protocol.PACKET_TYPES.PRE_SLEEP));
}


var workerJobMixin = {
    /**
     * Sends a notification to the server (and any listening clients) that the job completed successfully.
     */
    workComplete: function (data) {
        var jobServer = this.clientOrWorker._getJobServerByUid(this.jobServerUid);
        data = data || '';
        // error handling?
        this.clientOrWorker._sendWithJobServer(
            jobServer, protocol.encodePacket(protocol.PACKET_TYPES.WORK_COMPLETE, null, [this.handle, data]));
        this.clientOrWorker._preSleep(jobServer);
    },
    /**
     * This is sent to update the server (and any listening clients)
     * of the status of a running job.
     */
    reportStatus: function (numerator, denominator) {
        var jobServer = this.clientOrWorker._getJobServerByUid(this.jobServerUid);
        // error handling?
        this.clientOrWorker._sendWithJobServer(
            jobServer, protocol.encodePacket(protocol.PACKET_TYPES.WORK_STATUS, null, [this.handle, numerator, denominator]));
    }
}
common.mixin(workerJobMixin, Job.prototype);
