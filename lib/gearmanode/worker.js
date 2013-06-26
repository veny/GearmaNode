/*
 * This script represents class communicating as a worker with Gearman job server.
 *
 * (C) 2013 Vaclav Sykora
 * Apache License, Version 2.0, http://www.apache.org/licenses/
 *
 */

var util       = require('util'),
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

    Worker.logger.log('info', 'worker initialized with %d job server(s)', this.jobServers.length);
};

// inheritance
util.inherits(Worker, ServerMate);

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
    var jobServer;
    var self = this;

    for (var i = 0; i < this.jobServers.length; i ++) {
        jobServer = this.jobServers[i];
        jobServer.connect(function() {
            jobServer.send(self._encode('reverse'), 'ascii');
        });

    }
};


/**
 * Returns a human readable string representation of the object.
 */
Worker.prototype.toString = function() { // #unit: not needed
	return 'Worker(jobServers=' + util.inspect(this.jobServers) + ')';
}


// Only temp function for quick elaboration.
Worker.prototype._encode = function(name) {
    var packetLength = 12 + name.length;  // 12 byte header
    var buff = new Buffer(packetLength);

    buff.writeUInt32BE(0x00524551, 0); // \0REQ
    buff.writeUInt32BE(protocol.PACKET_TYPES.CAN_DO, 4);
    buff.writeUInt32BE(packetLength, 8);
    buff.write(name, 12, 'ascii');
    return buff;
}
