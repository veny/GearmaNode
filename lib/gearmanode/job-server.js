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
    // static register of all job servers

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
    var eventNames;

    if (!(callback instanceof Function)) { return new Error('invalid callback (not a function)'); }

    if (this.connected) {
        callback();
    } else {
        this.socket = net.createConnection(this.port, this.host);

        // fallback event registration, only for debugging purposes
        eventNames = [ 'end', 'close', 'timeout', 'drain' ];
        eventNames.forEach(function (name) {
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
            JobServer.logger.log('verbose', 'received packet, len=%d', chunk.length);
            JobServer.logger.log('verbose', 'data: %s', common.bufferAsHex(chunk));

            self.processData(chunk);
        });
    }

    return this.socket;
};


JobServer.prototype.disconnect = function () {
    var i, eventNames;

    this.connected = false;
    if (this.client) { // bidirectional association management
        this.client.emit('disconnect');
        delete this.client;
    }

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

    // remove listeners from socket
    eventNames = [ 'connect', 'data', 'error', 'end', 'close', 'timeout', 'drain' ];
    for (i = 0; i < eventNames.length; i ++) {
        this.socket.removeAllListeners(eventNames[i]);
    }

    if (this.socket) {
        this.socket.end();
        delete this.socket;
    }
    JobServer.logger.log('debug', 'connection closed: ', this.toString('minimal'));
};


/**
 * Submits given job to a job server.
 *
 * *callback(err)* called as
 *     * error callback when anything goes wrong
 *     * success callback when the job sent/submited over socket, err=undefined
 */
JobServer.prototype.submit = function (job, callback) {
    if (!this.connected) {
        callback(new Error('unconnected job server asked to send data'));
        return;
    }

    this.socket.write(job.encode(), job.encoding);
    job.processing = true;
    this.jobsWaiting4Created.push(job); // add to queue of submited jobs waiting for confirmation
    job.jobServer = this; // bidirectional association management
    JobServer.logger.log('debug', 'job submited, name=%s, type=%d', job.name, job.getPacketType());
    callback();
};


JobServer.prototype.getStatus = function (job, callback) {
    if (!this.connected) {
        callback(new Error('unconnected job server asked to submit a job'));
        return;
    }
}


JobServer.prototype.processData = function (chunk, callback) {
    if (!this.connected) {
        JobServer.logger.log('warn', 'trying to process data from disconnected job server (disconnect before all packet received?)');
        return;
    }

    if (chunk.readUInt32BE(0) != 0x00524553) { // \0RES
        // OUT OF SYNC!
        this._unrecoverableError('out of sync with server');
        return;
    }

    var handle, job, parsed;
    var proceed = 12, offset = 12;

    var packetType = chunk.readUInt32BE(4);
    var packetLength = chunk.readUInt32BE(8);

    switch (packetType) {
    case Job.PACKET_TYPES.JOB_CREATED:
        // handle
        parsed = this._parsePacket(chunk, 'L', 12 + packetLength);
        handle = parsed[1];

        // remove it from queue of jobs waiting for JOB_CREATED
        if (this.jobsWaiting4Created.length === 0) {
            this._unrecoverableError('empty stack of job waiting 4 status CREATED');
            return;
        }
        job = this.jobsWaiting4Created.pop();

        job.handle = handle;

        // and put it into hash of created jobs
        this.jobsWaiting4Complete[handle] = job;

        JobServer.logger.log('verbose', 'JOB_CREATED, handle=%s', handle);
        if (this.jobsWaiting4Created.length === 0) {
            JobServer.logger.log('debug', 'no more a job waiting for state CREATED');
            if (this.client) { this.client.emit('done'); } // trigger event
        }

        job.emit('created'); // trigger event
        proceed += packetLength;
        break;

    case Job.PACKET_TYPES.WORK_COMPLETE:
        // handle, returned_data
        parsed = this._parsePacket(chunk, 'nL', 12 + packetLength);
        handle = parsed[1];

        if (!this.jobsWaiting4Complete.hasOwnProperty(handle)) {
            this._unrecoverableError('work complete, but unknown job, handle=' + handle);
            return;
        }
        job = this.jobsWaiting4Complete[handle];
        job.processing = false;
        delete this.jobsWaiting4Complete[handle]; // remove it from hash of created jobs

        JobServer.logger.log('verbose', 'WORK_COMPLETE, handle=%s', handle);
        job.response = parsed[2];

        job.emit('complete'); // trigger event
        proceed += packetLength;
        break;

    case Job.PACKET_TYPES.STATUS_RES:
        // handle, known, running, numerator, denumerator
        parsed = this._parsePacket(chunk, 'nnnnL', 12 + packetLength);

        var result = {}
        result.known = '1' == parsed[2];
        result.running = '1' == parsed[3];
        result.percent_done_num = parsed[4];
        result.percent_done_den = parsed[5];
console.log('STATUS_RES ' + util.inspect(result));

        proceed += packetLength;
        break;

    // for non-background jobs, the server forwards this packet from the worker to clients (Gearman Docu)
    case Job.PACKET_TYPES.WORK_STATUS:
        // handle, numerator, denumerator
        parsed = this._parsePacket(chunk, 'nnL', 12 + packetLength);

        var result = {}
        result.percent_done_num = parsed[2];
        result.percent_done_den = parsed[3];
console.log('WORK_STATUS ' + util.inspect(result));

        proceed += packetLength;
        break;

    case Job.PACKET_TYPES.ERROR:
        // code, text
        parsed = this._parsePacket(chunk, 'nL', 12 + packetLength);
console.log('ERROR code=' + parsed[1] + ', msg=' + parsed[2]);

        proceed += packetLength;
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
 * Gets an unique identifier of job server represented by the URL address.
 */
JobServer.prototype.getUid = function() {
    return this.host + ':' + this.port;
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


/**
 * *N* NULL byte terminated string (encoding according to job's encoding)
 * *n* NULL byte terminated string (ASCII encoding)
 * *L* last segment of buffer (encoding according to job's encoding)
 */
JobServer.prototype._parsePacket = function (buff, format, maxLen) {
    var i, j, key;
    var rslt = [];
    var offset = 12; // packet header len

    for (i = 0; i < format.length; i ++) {
        key = format.charAt(i);

        if ('N' == key || 'n' == key) {
            // find next NULL
            for (j = offset; j < buff.length; j ++) {
                if (buff.readUInt8(j) == 0) {
                    break;
                }
            }
            rslt[i + 1] = buff.toString('n' == key ? 'ascii' : this.encoding, offset, j);
            offset = j + 1; // +1 == skip NULL
        } else if ('L' == key) { // LAST segment up to maxLen
            rslt[i + 1] = buff.toString(this.encoding, offset, maxLen);
            offset = maxLen;
        } else {
            return new Error('unknow format: ' + format);
        }
    }

    rslt[0] = offset;
    return rslt;
}


JobServer.prototype._unrecoverableError = function (msg) { // #unit: not needed
    JobServer.logger.log('error', msg);
    if (this.client) {
        this.client.emit('error', new Error(msg)); // trigger event
    }
}