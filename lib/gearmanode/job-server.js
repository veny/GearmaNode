/*
 * This script introduces a class representing a Gearman job server
 * and knowledge about protocol to communicate with it.
 *
 * (C) 2013 Vaclav Sykora
 * Apache License, Version 2.0, http://www.apache.org/licenses/
 *
 */


var net      = require('net'),
    util     = require('util'),
    winston  = require('winston'),
    Job      = require('./job').Job,
    common   = require('./common');


var JobServer = exports.JobServer = function (options) {
    // static logger
    if (JobServer.logger === undefined) {
        JobServer.logger = winston.loggers.get('JobServer');
    }

    options = options || {};

    // VALIDATION
    var pattern = { host: 'mandatory', port: 'mandatory' };
    var returned = common.verifyOptions(options, pattern);
    if (returned instanceof Error) { return returned; }

    this.host = options.host;
    this.port = options.port;

    this.connected = false;
    this.jobsWaiting4Created = []; // submited jobs waiting for JOB_CREATED response
    this.jobsWaiting4Complete = {}; // jobs with ID waiting for WORK_COMPLETE
};


/**
 * Method to establish a socket connection to a job server.
 * *callback(err)* called as
 *     * error callback when connection failed
 *     * success callback if connection opened, err=undefined
 */
JobServer.prototype.connect = function (callback) {
    var self = this;

    if (!(callback instanceof Function)) { return new Error('invalid callback (not a function)'); }

    if (!this.connected) {
        this.socket = net.createConnection(this.port, this.host);

        // fallback event registration, only for debugging purposes
        var evNames = [ 'end', 'close', 'timeout', 'drain' ];
        evNames.forEach(function (name) {
            self.socket.on(name, function() {
                JobServer.logger.log('warn', 'unhandled event, name=%s', name);
            });
        });

        // emitted when a socket connection is successfully established
        this.socket.on('connect', function () {
            self.socket.setKeepAlive(true);
            self.connected = true;
            JobServer.logger.log('debug', 'connection established: ', self.toString('minimal'));
            callback();
        });

        // emitted when an error occurs
        this.socket.on('error', function (err) {
            self.socket.destroy();
            delete self.socket;
            self.connected = false;
            JobServer.logger.log('error', 'socket error', err);
            callback(err);
        });

        this.socket.on('data', function (chunk) {
            JobServer.logger.log('verbose', 'received packet, len=' + chunk.length);
            JobServer.logger.log('verbose', 'data: %s', common.bufferAsHex(chunk));

            self.processData(chunk);
        });
    }

    return this.socket;
};


JobServer.prototype.disconnect = function () {
    var i;

    this.connected = false;
    if (this.client) { delete this.client; }

    // clear buffered jobs #1
    for (i = 0; i < this.jobsWaiting4Created.length; i ++) {
        this.jobsWaiting4Created[i].abort();
    }
    this.jobsWaiting4Created.length = 0;
    // clear buffered jobs #2
    for (i in this.jobsWaiting4Complete) {
        if (this.jobsWaiting4Complete.hasOwnProperty(i)) {
            this.jobsWaiting4Complete[i].abort();
            delete this.jobsWaiting4Complete[i];
        }
    }

    if (this.socket) {
        this.socket.end();
        delete this.socket;
    }
    JobServer.logger.log('debug', 'connection closed: ', this.toString('minimal'));
};


/**
 * Submits given job to job server.
 *
 * *callback(err)* called as
 *     * error callback when anything goes wrong
 *     * success callback when the job sent/submited over socket, err=undefined
 */
JobServer.prototype.submit = function (job, callback) {
    if (!this.connected) {
        callback(new Error('unconnected job server asked to submit a job'));
        return;
    }

    this.socket.write(job.encode(), job.encoding);
    job.processing = true;
    this.jobsWaiting4Created.push(job); // add to queue of submited jobs waiting fot confirmation
    JobServer.logger.log('debug', 'job submited, name=%s, type=%d', job.name, job.getPacketType());
    callback();
};


JobServer.prototype.processData = function (chunk, callback) {
    if (!this.connected) {
        JobServer.logger.log('warn', 'trying to process data from disconnected job server (disconnect before all packet received?)');
        return;
    }

    if (chunk.readUInt32BE(0) != 0x00524553) { // \0RES
        // OUT OF SYNC!
        var msg = 'out of sync with server';
        JobServer.logger.log('error', msg);
        this.client.emit('error', new Error(msg)); // trigger event
        return;
    }

    var jobId, job;
    var proceed = 12;

    var packetType = chunk.readUInt32BE(4);
    // response needs to be 12 bytes + body length (job handle + payload)
    var packetLength = chunk.readUInt32BE(8);

    switch (packetType) {
    case Job.PACKET_TYPES.JOB_CREATED:
        jobId = Job.getJobId(chunk, 12, 12 + packetLength);
        job = this.jobsWaiting4Created.pop(); // remove it from queue of jobs waiting for JOB_CREATED, TODO emit event if empty queue
        job.id = jobId;
        this.jobsWaiting4Complete[jobId] = job; // and put it into hash of created jobs

        proceed += packetLength;
        JobServer.logger.log('verbose', 'job created, jobId=%s', jobId);
        if (this.jobsWaiting4Created.length === 0) {
            JobServer.logger.log('debug', 'no more a job waiting for state CREATED');
            this.client.emit('done'); // trigger event
        }

        job.emit('created'); // trigger event
        break;

    case Job.PACKET_TYPES.WORK_COMPLETE:
        // skip job handle => find next NULL
        var next0 = 12
        for (; next0 < chunk.length; next0 ++) {
            if (chunk.readUInt8(next0) == 0) {
                break;
            }
        }
        jobId = Job.getJobId(chunk, 12, next0);
        job = this.jobsWaiting4Complete[jobId]; // TODO emit error if not found
        job.processing = false;
        delete this.jobsWaiting4Complete[jobId]; // remove it from hash of created jobs

        JobServer.logger.log('verbose', 'work complete, jobId=%s', jobId);
        next0 ++;
        job.response = chunk.toString(job.encoding, next0, 12 + packetLength);

        proceed += packetLength;

        job.emit('complete'); // trigger event
        break;

    default:
        JobServer.logger.log('warn', 'unknown packet, type=%d', packetType);
        proceed = chunk.length; // stop processing of rest of the chunk
    }


    // recursive approach when more packets in buffer
    if (proceed < chunk.length) {
        this.processData(chunk.slice(proceed));
    }
}


/**
 * Returns a human readable string representation of the object.
 */
JobServer.prototype.toString = function (how) { // #unit: not needed
    if (how == 'minimal') {
        return 'host=' + this.host + ', port=' + this.port;
    }
    return 'JobServer(' + this.toString('minimal') + ')';
}
