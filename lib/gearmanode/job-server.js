/*
 * This script introduces a class representing a Gearman job server
 * and knowledge about protocol to communicate with it.
 *
 * (C) 2013 Vaclav Sykora
 * Apache License, Version 2.0, http://www.apache.org/licenses/
 *
 */


var net      = require('net'),
    winston  = require('winston'),
    Job      = require('./job').Job,
    protocol = require('./protocol'),
    common   = require('./common');


var JobServer = exports.JobServer = function (options) {
    options = options || {};

    // VALIDATION
    var pattern = { host: 'mandatory', port: 'mandatory' };
    var returned = common.verifyOptions(options, pattern);
    if (returned instanceof Error) { return returned; }

    this.host = options.host;
    this.port = options.port;

    this.connected = false;
    this.jobsWaiting4Created = []; // submited jobs waiting for JOB_CREATED response
};

// static logger
JobServer.logger = winston.loggers.get('JobServer');


/**
 * Method to establish a socket connection to a job server.
 *
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
            self.mate.emit('js_connect', self.getUid()); // trigger event
            JobServer.logger.log('debug', 'connection established, uid=%s', self.getUid());
            callback();
        });

        // emitted when an error occurs
        this.socket.on('error', function (err) {
            JobServer.logger.log('error', 'socket error', err);
            // ensures that no more I/O activity happens on this socket
            self.socket.destroy();

            self.disconnect();
            callback(err);
        });

        this.socket.on('data', function (chunk) {
            JobServer.logger.log('verbose', 'received packet, len=%d', chunk.length);
            JobServer.logger.log('verbose', 'data: %s', common.bufferAsHex(chunk));

            self._processData(chunk);
        });
    }

    return this.socket;
};


/**
 * Ends connection with job server and releases associated resources,
 * e.g. underlaying socket connection.
 * Sets property 'connected' to 'false'.
 */
JobServer.prototype.disconnect = function () {
    var i, eventNames;

    this.connected = false;
    if (this.mate) {
        this.mate.emit('js_disconnect');
        delete this.mate; // bidirectional association management
    }

    // close jobs waiting for packet JOB_CREATED
    for (i = 0; i < this.jobsWaiting4Created.length; i ++) {
        this.jobsWaiting4Created[i].close();
    }
    this.jobsWaiting4Created.length = 0;

    if (this.socket) {
        // remove listeners from socket
        eventNames = [ 'connect', 'data', 'error', 'end', 'close', 'timeout', 'drain' ];
        for (i = 0; i < eventNames.length; i ++) {
            this.socket.removeAllListeners(eventNames[i]);
        }

        this.socket.end();
        delete this.socket;
    }
    JobServer.logger.log('debug', 'connection closed, uid=%s', this.getUid());
};


/**
 * Sends given data through socket connection with defined encoding.
 * Underlaying socket connection with job server will be created when does not exist.
 *
 * *callback(err)* called as
 *     * error callback when sending failed
 *     * success callback if data sent, err=undefined
 */
JobServer.prototype.send = function (data, encoding, callback) {
    var packetType, connectCb, sendCb;
    var self = this;

    if (!(callback instanceof Function)) { return new Error('invalid callback (not a function)'); }

    // VALIDATION
    if (!(data instanceof Buffer)) {
        callback(new Error('data has to be object of Buffer'));
        return;
    }
    if (data.length < 12) {
        callback(new Error('short data'));
        return;
    }
    if (0x00524551 != data.readUInt32BE(0)) { // TODO constant
        callback(new Error('no gearman packet'));
        return;
    }

    // set default encoding
    encoding = encoding || 'ascii';

    // invoked after connection established
    connectCb = function (connectErr) {
        if (connectErr instanceof Error) {
            callback(connectErr); // connection failed
        } else {
            sendCb();
        }
    };

    sendCb = function () {
        self.socket.write(data, encoding);

        packetType = data.readUInt32BE(4);
        JobServer.logger.log('verbose', 'packet sent, type=%s, len=%d',
            protocol.PACKET_CODES[packetType], data.length);
        callback();
    }

    if (this.connected) {
        sendCb();
    } else {
        JobServer.logger.log('debug', 'unconnected job server, uid=%s', this.getUid());
        this.connect(connectCb);
    }
}


JobServer.prototype._processData = function (chunk) {
    if (!this.connected) {
        JobServer.logger.log('warn', 'trying to process data from disconnected job server (disconnect before all packet received?)');
        return;
    }

    if (chunk.readUInt32BE(0) != 0x00524553) { // \0RES
        // OUT OF SYNC!
        this._unrecoverableError('out of sync with server');
        return;
    }

    var handle, job, parsed, processed, status;
    var packetType = chunk.readUInt32BE(4);

    switch (packetType) {
    case protocol.PACKET_TYPES.JOB_CREATED:
        // handle
        parsed = protocol.parsePacket(chunk, 'L');
        handle = parsed[1];

        // remove it from queue of jobs waiting for JOB_CREATED
        if (this.jobsWaiting4Created.length === 0) {
            this._unrecoverableError('empty stack of job waiting 4 packet JOB_CREATED');
            return;
        }
        job = this.jobsWaiting4Created.pop();
        job.handle = handle;

        // and put it into hash of created jobs on Client
        this.mate.jobs[handle] = job;

        JobServer.logger.log('verbose', 'JOB_CREATED, handle=%s', handle);
        if (this.jobsWaiting4Created.length === 0) {
            JobServer.logger.log('verbose', 'no more a job waiting 4 state JOB_CREATED');
            this.mate.emit('done'); // trigger event
        }

        job.emit('created'); // trigger event
        break;

    case protocol.PACKET_TYPES.WORK_COMPLETE:
        // handle, returned_data
        parsed = protocol.parsePacket(chunk, 'nL');
        handle = parsed[1];

        //REUSE1
        if (!this.mate.jobs.hasOwnProperty(handle)) {
            this._unrecoverableError('work complete, but unknown job, handle=' + handle);
            return;
        }
        job = this.mate.jobs[handle];
        job.processing = false;
        delete this.mate.jobs[handle]; // remove it from table of submited & incomplete jobs

        JobServer.logger.log('verbose', 'WORK_COMPLETE, handle=%s', handle);
        job.response = parsed[2];

        job.emit('complete'); // trigger event
        break;

    // for background jobs in response to a GET_STATUS request (Gearman Docu)
    case protocol.PACKET_TYPES.STATUS_RES:
        // handle, known, running, numerator, denumerator
        parsed = protocol.parsePacket(chunk, 'nnnnL');
        handle = parsed[1];

        //REUSE1
        if (!this.mate.jobs.hasOwnProperty(handle)) {
            this._unrecoverableError('work complete, but unknown job, handle=' + handle);
            return;
        }
        job = this.mate.jobs[handle];

        status = {}
        status.known = '1' == parsed[2];
        status.running = '1' == parsed[3];
        status.percent_done_num = parsed[4];
        status.percent_done_den = parsed[5];
        JobServer.logger.log('verbose', 'STATUS_RES, handle=%s, known=%d, running=%d, num=%d, den=%d',
            handle, status.known, status.running, status.percent_done_num, status.percent_done_den);

        job.emit('status', status); // trigger event
        break;

    // for non-background jobs, the server forwards this packet from the worker to clients (Gearman Docu)
    case protocol.PACKET_TYPES.WORK_STATUS:
        // handle, numerator, denumerator
        parsed = protocol.parsePacket(chunk, 'nnL');
        handle = parsed[1];

        //REUSE1
        if (!this.mate.jobs.hasOwnProperty(handle)) {
            this._unrecoverableError('work complete, but unknown job, handle=' + handle);
            return;
        }
        job = this.mate.jobs[handle];

        status = {}
        status.percent_done_num = parsed[2];
        status.percent_done_den = parsed[3];
        JobServer.logger.log('verbose', 'WORK_STATUS, handle=%s, num=%d, den=%d',
            handle, status.percent_done_num, status.percent_done_den);

        job.emit('status', status); // trigger event
        break;

    case protocol.PACKET_TYPES.ERROR:
        // code, text
        parsed = protocol.parsePacket(chunk, 'nL');
        JobServer.logger.log('warn', 'job server error, code=' + parsed[1] + ', msg=' + parsed[2]);

        this.mate.emit('js_error', 'code=' + parsed[1] + ', msg=' + parsed[2]); // trigger event
        break;

    // WORKER =================================================================

    case protocol.PACKET_TYPES.NOOP:
        // None
        parsed = protocol.parsePacket(chunk);
        JobServer.logger.log('verbose', 'NOOP, uid=%s', this.getUid());

        this.mate.noop(this);
        break;

    default:
        JobServer.logger.log('warn', 'unknown packet, type=%d', packetType);
        processed = chunk.length; // stop processing of rest of the chunk
    }

    if (parsed) {
        processed = parsed[0];
    }

    // recursive approach when more packets in buffer
    if (processed < chunk.length) {
        this._processData(chunk.slice(processed));
    }
}


/**
 * Gets an unique identifier of job server represented by the URL address.
 */
JobServer.prototype.getUid = function() { // #unit: not needed
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


JobServer.prototype._unrecoverableError = function (msg) { // #unit: not needed
    JobServer.logger.log('error', msg);
    if (this.mate) {
        this.mate.emit('error', new Error(msg)); // trigger event
    }
}
