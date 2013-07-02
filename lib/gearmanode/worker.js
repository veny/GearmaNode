/*
 * This script represents class communicating as a worker with Gearman job server.
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
 *    * host - hostname of single job server
 *    * port - port of single job server
 *    * servers - array of host,port pairs of multiple job servers
 */
var Worker = exports.Worker = function(options) {

    // call super-constructor
    var mate = ServerMate.call(this, options);
    if (mate instanceof Error) { return mate; }

    events.EventEmitter.call(this);
    Worker.logger.log('info', 'worker initialized with %d job server(s)', this.jobServers.length);
};

// inheritance
util.inherits(Worker, ServerMate);
util.inherits(Worker, events.EventEmitter);

// static logger
Worker.logger = winston.loggers.get('Worker');


/**
 * Registers a function name with the job server and specifies a callback corresponding to that function.
 *
 * *name* name of a function
 * *callback(err)* called as
 *     * error callback when anything goes wrong
 *     * success callback when action successfully terminated
 * *options*
 *    * timeout - the timeout value, the job server will mark the job as failed and notify any listening clients (optional) - TODO
 *    * withUnique - flag whether a job will be grabbed with the client assigned unique ID - TODO
 */
Worker.prototype.addFuntion = function(name, callback, options) { // #unit: TODO test it
    var jobServer, cb;

    cb = function (err) {
        if (err instanceof Error) {
            Worker.logger.log('error', util.inspect(err));
            callback(err);
            return;
        }
    }

    for (var i = 0; i < this.jobServers.length; i ++) {
        jobServer = this.jobServers[i];
        jobServer.send(protocol.encodePacket(protocol.PACKET_TYPES.CAN_DO, 'ascii', [name]), 'ascii', cb);
        jobServer.send(protocol.encodePacket(protocol.PACKET_TYPES.PRE_SLEEP), 'ascii', cb);
        Worker.logger.log('debug', 'registered function name=%s on server uid=%s', name, jobServer.getUid());
    }
}


Worker.prototype.noop = function(jobServer) {
    var cb;

    cb = function (err) {
        if (err instanceof Error) {
            Worker.logger.log('error', util.inspect(err));
            callback(err);
            return;
        }
    }
    jobServer.send(protocol.encodePacket(protocol.PACKET_TYPES.GRAB_JOB), 'ascii', cb);
}


/**
 * Returns a human readable string representation of the object.
 */
Worker.prototype.toString = function() { // #unit: not needed
	return 'Worker(jobServers=' + util.inspect(this.jobServers) + ')';
}
