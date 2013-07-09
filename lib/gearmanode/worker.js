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

    // call ServerManager initialization
    returned = this.init(this, options);
    if (returned instanceof Error) { return returned; }
    this._type = 'Worker';

    // table of functions successfully registered on a job server
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
 * *callback(payload,)* the function to be run when a job is received,  gets two parameters
 *     *workerJob - interface to turn over assigned job and report job information to the job server
 *        *sendWorkComplete - sends a notification to the server (and any listening clients) the that job completed successfully.
 *        *reportStatus - reports job's status to the job server
 *        *reportWarning - sends a warning explicitly to the job server
 *        *reportError - to indicate that the job failed
 *        *sendData - send data before job completes
 *        * name - name of the function
 *        *jobServerUid - getter
 *        *handle - getter
 *        *payload - received data (Buffer or String)
 * *options*
 *    *timeout - the timeout value, the job server will mark the job as failed and notify any listening clients (optional) - TODO
 *    *withUnique - flag whether a job will be grabbed with the client assigned unique ID - TODO
 *    *toStringEncoding - if given received payload will be converted to String with this encoding, otherwise payload turned over as Buffer
 */
Worker.prototype.addFuntion = function(name, callback, options) { // #unit: TODO test it
    var jobServer;

    for (var i = 0; i < this.jobServers.length; i ++) {
        jobServer = this.jobServers[i];
        this._sendWithJobServer(jobServer, protocol.encodePacket(protocol.PACKET_TYPES.CAN_DO, 'ascii', [name]));
        this._sendWithJobServer(jobServer, protocol.encodePacket(protocol.PACKET_TYPES.PRE_SLEEP));
        // TODO error handling, only if all OK
        this.functions[name] = callback;
        Worker.logger.log('debug', 'registered function name=%s on server uid=%s', name, jobServer.getUid());
    }
}


/**
 * Invoked when a job server response is delivered.
 */
Worker.prototype.response = function (jobServer, packetType, parsedPacket) {
    switch (packetType) {
    case protocol.PACKET_TYPES.NOOP:
        this._sendWithJobServer(jobServer, protocol.encodePacket(protocol.PACKET_TYPES.GRAB_JOB));
        break;
    case protocol.PACKET_TYPES.JOB_ASSIGN:
        console.log('===== ' + util.inspect(parsedPacket));
        var job = new Job(this,
            { handle: parsedPacket[1], name: parsedPacket[2], payload: parsedPacket[3], jobServerUid: jobServer.getUid() });
        var func = this.functions[job.name];
        console.log('===== ' + job.toString()); // TODO parameters + error handling
        var rslt = func(job);
//        this._sendWithJobServer(jobServer, protocol.encodePacket(protocol.PACKET_TYPES.WORK_COMPLETE, null, [job.handle, xx]));
        this._sendWithJobServer(jobServer, protocol.encodePacket(protocol.PACKET_TYPES.PRE_SLEEP));
        break;
    }
}


Worker.prototype._sendWithJobServer = function (jobServer, buffer) {
    var self = this;
    var cb = function (err) {
        if (err instanceof Error) {
            Worker.logger.log('error', util.inspect(err));
            self.emit('js_error', err);
        }
    }
    jobServer.send(buffer, cb);
}


/**
 * Returns a human readable string representation of the object.
 */
Worker.prototype.toString = function() { // #unit: not needed
	return 'Worker(jobServers=' + util.inspect(this.jobServers) + ')';
}


var workerJobMixin = {
    /**
     * Sends a notification to the server (and any listening clients) that the job completed successfully.
     */
    workComplete: function (data) {
        var jobServer = this.clientOrWorker._getJobServerByUid(this.jobServerUid);
        //
        jobServer.send(protocol.encodePacket(protocol.PACKET_TYPES.WORK_COMPLETE, null, [this.handle, data]), function() {});
        Job.logger.log('verbose', 'WORK_COMPLETE ' + this.toString());
    }
}
common.mixin(workerJobMixin, Job.prototype);
