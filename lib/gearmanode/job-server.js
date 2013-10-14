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
 * It uses a callback parameter as a synchronisation hook for 'after connect' actions.
 *
 * *callback(err)* called as
 *     * error callback when connection failed
 *     * success callback if connection opened, err=undefined
 *
 * Returns net.Socket if success.
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
            self.clientOrWorker.emit('js_connect', self.getUid()); // trigger event
            JobServer.logger.log('debug', 'connection established, uid=%s', self.getUid());
            callback();
        });

        // emitted when an error occurs
        this.socket.on('error', function (err) {
            JobServer.logger.log('error', 'socket error:', err);
            // ensures that no more I/O activity happens on this socket
            self.socket.destroy();

            self.disconnect();
            callback(err);
        });

        this.socket.on('data', function (chunk) {
            JobServer.logger.log('verbose', 'received packet, len=%d', chunk.length);
            JobServer.logger.log('verbose', 'received packet: %s', common.bufferAsHex(chunk));

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

    if (this.clientOrWorker && this.connected) {
        this.clientOrWorker.emit('disconnect', this.getUid());
    }
    this.connected = false;

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

    // TODO: remove event listeners from itself (after JobServer becomes EventEmitter)

    JobServer.logger.log('debug', 'connection closed, uid=%s', this.getUid());
};


/**
 * Sends the job server request that will be echoed back in response.
 *
 * *data* opaque data that is echoed back in response
 * *callback(err,echoedData)* called as
 *     * error callback when somethings went wrong
 *     * success callback response of the job server, will be invoked with echoed data as parameter
 */
JobServer.prototype.echo = function (data, callback) {
    return this._requestReponse(protocol.PACKET_TYPES.ECHO_REQ, data, callback);
}


/**
 * Sends the job server request to set an option for the connection in the job server.
 *
 * *optionName* name of the option to set
 * *callback(err,data)* called as
 *     * error callback when somethings went wrong
 *     * success callback response of the job server, will be invoked with echoed data as parameter
 */
JobServer.prototype.setOption = function (optionName, callback) {
    return this._requestReponse(protocol.PACKET_TYPES.OPTION_REQ, optionName, callback);
}


/**
 * Sends given packet to job servers and wait for response with callback.
 * Re-usable helper method.
 */
JobServer.prototype._requestReponse = function (packetType, data, callback) {
    var self = this;
    var packet, cb;
    if (!common.isString(data)) { return new Error('data for job server not a text'); }
    if (!(callback instanceof Function)) { return new Error('invalid callback (not a function)'); }
    this.expectedJsResponseCallback = callback;

    cb = function (err) {
        if (err instanceof Error) {
            JobServer.logger.log('error', 'failed to send %s, uid=%s', protocol.PACKET_CODES[packetType], this.getUid());
            delete self.expectedJsResponseCallback;
            callback(err);
        }
    };

    packet = protocol.encodePacket(packetType, 'ascii', [data]);
    this.send(packet, cb);
}


/**
 * Sends given data as Buffer through socket connection.
 * Underlaying socket connection with job server will be created when does not exist.
 *
 * Error event will be emitted on associated client/worker when something goes wrong.
 */
JobServer.prototype.send = function (data) {
    var self = this;
    var connectCb, sendCb;

    // VALIDATION
    if (!(data instanceof Buffer)) { return this._error(JobServer.logger, 'data has to be object of Buffer'); }
    if (data.length < protocol.CONSTANTS.HEADER_LEN) { return this._error(JobServer.logger, 'short data'); }
    if (protocol.CONSTANTS.HEADER_REQ != data.readUInt32BE(0)) { return this._error(JobServer.logger, 'no gearman packet'); }

    // invoked after connection established
    connectCb = function (connectErr) {
        if (connectErr instanceof Error) {
            self._error(connectErr); // connection failed
        } else {
            sendCb();
        }
    };

    sendCb = function () {
        self.socket.write(data);
        JobServer.logger.log('verbose', 'packet sent, type=%s, len=%d', protocol.PACKET_CODES[data.readUInt32BE(4)], data.length);
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

    if (chunk.readUInt32BE(0) !== protocol.CONSTANTS.HEADER_RESP) {
        // OUT OF SYNC!
        this.clientOrWorker.unrecoverableError('out of sync with server');
        return;
    }

    var handle, job, parsedPacket, processed, status;
    var packetType = chunk.readUInt32BE(4);
    var packetCode = protocol.PACKET_CODES[packetType];

    // parse packet if it is a response
    if (protocol.DEFINITION[packetCode] !== undefined
        && (protocol.CONSTANTS.TYPE_RESP & protocol.DEFINITION[packetCode][1])) {
        parsedPacket = protocol.parsePacket(chunk, protocol.DEFINITION[packetCode][2]);
    }


    switch (packetType) {

    // CLIENT/WORKER ==========================================================

    case protocol.PACKET_TYPES.ERROR:
        JobServer.logger.log('warn', 'job server error, uid=%s, code=%s, msg=%s',
            this.getUid(), parsedPacket[1], parsedPacket[2]);
        if (parsedPacket[1] == protocol.CONSTANTS.UNKNOWN_OPTION && this.expectedJsResponseCallback) {
            var cb = this.expectedJsResponseCallback;
            delete this.expectedJsResponseCallback;
            cb(new Error(parsedPacket[1], parsedPacket[2]));
        } else {
            this.clientOrWorker.emit('error', 'code=' + parsedPacket[1] + ', msg=' + parsedPacket[2]); // trigger event
        }
        break;

    case protocol.PACKET_TYPES.ECHO_RES:
    case protocol.PACKET_TYPES.OPTION_RES:
        if (this.expectedJsResponseCallback) {
            var cb = this.expectedJsResponseCallback;
            delete this.expectedJsResponseCallback;
            cb(null, parsedPacket[1]);
        } else {
            JobServer.logger.log('warn', 'received %s without registered callback', protocol.PACKET_CODES[packetType]);
        }
        break;


    // CLIENT =================================================================

    case protocol.PACKET_TYPES.JOB_CREATED:
        handle = parsedPacket[1];

        // remove it from queue of jobs waiting for JOB_CREATED
        if (this.jobsWaiting4Created.length === 0) {
            this.clientOrWorker.unrecoverableError('empty stack of job waiting 4 packet JOB_CREATED');
            return;
        }
        job = this.jobsWaiting4Created.pop();
        job.handle = handle;

        // and put it into hash of created jobs on Client
        this.clientOrWorker.jobs[handle] = job;

        if (this.jobsWaiting4Created.length === 0) {
            JobServer.logger.log('verbose', 'no more a job waiting 4 state JOB_CREATED');
            this.clientOrWorker.emit('done'); // trigger event
        }

        this.clientOrWorker.response(null, packetType, parsedPacket);
        break;

    case protocol.PACKET_TYPES.WORK_COMPLETE:
    case protocol.PACKET_TYPES.STATUS_RES: // for background jobs in response to a GET_STATUS request (Gearman Docu)
    case protocol.PACKET_TYPES.WORK_STATUS: // for non-background jobs, the server forwards this packet from the worker to clients (Gearman Docu)
    case protocol.PACKET_TYPES.WORK_FAIL: // for non-background jobs, the server forwards this packet from the worker to clients (Gearman Docu)
    case protocol.PACKET_TYPES.WORK_EXCEPTION: // for non-background jobs, the server forwards this packet from the worker to clients (Gearman Docu)

        this.clientOrWorker.response(null, packetType, parsedPacket);
        break;

    // WORKER =================================================================

    case protocol.PACKET_TYPES.NOOP:
    case protocol.PACKET_TYPES.JOB_ASSIGN:
    case protocol.PACKET_TYPES.NO_JOB:

        this.clientOrWorker.response(this, packetType, parsedPacket);
        break;

    // ========================================================================

    default:
        JobServer.logger.log('warn', 'unknown packet, type=%d', packetType);
        processed = chunk.length; // stop processing of rest of the chunk
    }


    if (parsedPacket) {
        processed = parsedPacket[0];
    }

    // recursive approach when more packets in buffer
    if (processed < chunk.length) {
        this._processData(chunk.slice(processed));
    }
}


/**
 * Processes an error that cannot be covered by client/worker.
 */
JobServer.prototype._error = function (err) { // #unit: not needed
    JobServer.logger.log('error', err);
    if (!this.clientOrWorker) {
        throw new Error('there is no client/worker associated with this job server (never should be state)');
    } else {
        this.clientOrWorker.emit('error', err instanceof Error ? err : new Error(err)); // trigger event
    }
}


/**
 * Gets an unique identifier of job server represented by the URL address.
 */
JobServer.prototype.getUid = function () { // #unit: not needed
    return this.host + ':' + this.port;
}


/**
 * Returns a human readable string representation of the object.
 */
JobServer.prototype.toString = function () { // #unit: not needed
    return 'JobServer(' + this.getUid() + ')';
}
