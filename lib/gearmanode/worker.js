/*
 * This script represents class communicating as a worker with Gearman job server.
 *
 * (C) 2013 Vaclav Sykora
 * Apache License, Version 2.0, http://www.apache.org/licenses/
 *
 */

var util      = require('util'),
	winston   = require('winston'),
    protocol  = require('./protocol'),
    Job       = require('./job').Job;


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
};

// client emits events based on life cycle
util.inherits(Worker, events.EventEmitter);

// static logger
Worker.logger = winston.loggers.get('Worker');


/**
 * Registers a function name with the job server and specifies a callback corresponding to that function.
 *
 * *name* name of a function
 * *callback(err,job)* called as
 *     * error callback when job invalid defined or connection fails
 *     * success callback when the job sent/submited over socket with new Job instance as parameter
 * * timeout* the timeout value, the job server will mark the job as failed and notify any listening clients (optional)
 */
Worker.prototype.addFuntion = function(name, callback, timeout) { // #unit: TODO test it
};




/**
 * Returns a human readable string representation of the object.
 */
Client.prototype.toString = function() { // #unit: not needed
	return 'Worker(jobServers=' + util.inspect(this.jobServers) + ')';
}
