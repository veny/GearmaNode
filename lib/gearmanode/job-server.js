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
 * @fileoverview This script introduces a class representing a Gearman job server
 * and knowledge about protocol to communicate with it.
 * @author vaclav.sykora@google.com (Vaclav Sykora)
 */

var net      = require('net'),
    util     = require('util'),
    events   = require('events'),
    winston  = require('winston'),
    Job      = require('./job').Job,
    protocol = require('./protocol'),
    common   = require('./common');


// constants
var constants = exports.CONSTANTS = {
    DEFAULT_RECOVER_TIME: 30000
};


/**
 * @class JobServer
 * @classdesc A class representing an abstraction to Gearman job server (gearmand).
 * @constructor
 * @augments events.EventEmitter
 *
 * @param options literal representing the client
 * @param {string} options.host hostname of single job server
 * @param {number} options.port port of single job server
 */
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
    this.wrongDisconnectAt = 0;
    this.failedConnectionCount = 0;
};

// inheritance
util.inherits(JobServer, events.EventEmitter);

// static logger
JobServer.logger = winston.loggers.get('JobServer');


/**
 * Method to establish a socket connection to a job server.
 * It uses a callback parameter as a synchronisation hook for 'after connect' actions.
 *
 * @param {function} callback called as error callback when connection failed (error as paramater) or success callback if connection opened (err=undefined)
 * @method
 * @fires JobServer#js_connect
 * @returns {net.Socket} if success
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
        eventNames = [ 'lookup', 'timeout', 'drain' ];
        eventNames.forEach(function (name) {
            self.socket.on(name, function() {
                JobServer.logger.log('warn', 'unhandled event, name=%s', name);
            });
        });

        // emitted when a socket connection is successfully established
        this.socket.on('connect', function () {
            self.socket.setKeepAlive(true);
            self.connected = true;
            self.wrongDisconnectAt = 0;
            self.failedConnectionCount = 0
            self.emit('ConnectInternal140319214558');
            self.clientOrWorker.emit('socketConnect', self.getUid()); // trigger event
            JobServer.logger.log('debug', 'connection established, uid=%s', self.getUid());
            callback();
        });

        // emitted when an error occurs
        this.socket.on('error', function (err) {
            JobServer.logger.log('error', 'socket error:', err);
            // ensures that no more I/O activity happens on this socket
            self.socket.destroy();

            // inform load balancer that this server is invalid
            if (self.clientOrWorker._type === 'Client') {
                self.clientOrWorker.loadBalancer.badOne(self.clientOrWorker._getJobServerIndexByUid(self.getUid()));
            }

            // ECONNREFUSED, EPIPE, ...
            self.clientOrWorker.emit('socketError', self.getUid(), err); // trigger event
            self.disconnect(err);

            callback(err);
        });

        this.socket.on('data', function (chunk) {
// BF#6 var orig = null;
// if (chunk.length > 500) {
//     JobServer.logger.log('verbose', '=======================================');
//     orig = chunk;
//     chunk = chunk.slice(0, 500);
// }
            if (JobServer.logger.isLevelEnabled('verbose')) {
                JobServer.logger.log('verbose', 'received packet, len=%d', chunk.length);
                JobServer.logger.log('verbose', 'received packet: %s', common.bufferAsHex(chunk));
            }
            self._processData(chunk);
// BF#6 if (orig != null) {
//     self.socket.emit('data', orig.slice(500));
// }
        });

        // emitted once the socket is fully closed
        this.socket.on('close', function (had_error) {
            if (had_error) { // if the socket was closed due to a transmission error
                JobServer.logger.log('warn', 'connection closed due to an transmission error, uid=%s', self.getUid());
                // inform load balancer that this server is invalid
                if (self.clientOrWorker._type === 'Client') {
                    self.clientOrWorker.loadBalancer.badOne(self.clientOrWorker._getJobServerIndexByUid(self.getUid()));
                }
                self.disconnect(true); // true => simulates an error to set `wrongDisconnectAt` attribute
            }
        });

        // emitted when the other end of the socket sends a FIN packet (termination of other end)
        this.socket.on('end', function (err) {
            JobServer.logger.log('warn', 'connection terminated, uid=%s', self.getUid());
            // inform load balancer that this server is invalid
            if (self.clientOrWorker._type === 'Client') {
                self.clientOrWorker.loadBalancer.badOne(self.clientOrWorker._getJobServerIndexByUid(self.getUid()));
            }
            self.disconnect(err);
        });
    }

    return this.socket;
};


/**
 * Ends connection with job server and releases associated resources,
 * e.g. underlaying socket connection.
 * Sets property 'connected' to 'false'.
 *
 * @method
 * @param {Error} (optional) error causing the disconnection if any
 * @returns {void} nothing
 */
JobServer.prototype.disconnect = function (err) {
    var i, eventNames;

    this.connected = false;
    this.removeAllListeners();
    if (err !== undefined) {
        this.wrongDisconnectAt = new Date();
        this.failedConnectionCount += 1;
    }

    // close jobs waiting for packet JOB_CREATED
    for (i = 0; i < this.jobsWaiting4Created.length; i ++) {
        this.jobsWaiting4Created[i].close();
    }
    this.jobsWaiting4Created.length = 0;

    if (this.socket) {
        // remove listeners from socket
        this.socket.removeAllListeners();

        this.socket.unref(); // allow the program to exit if this is the only active socket in the event system
        this.socket.end();
        this.socket.destroy();
        delete this.socket;
    }

    this.clientOrWorker.emit('socketDisconnect', this.getUid(), err); // trigger event
    JobServer.logger.log('debug', 'connection closed, uid=%s', this.getUid());
};


/**
 * Sends the job server request that will be echoed back in response.
 *
 * @method
 * @param {string} opaque data that is echoed back in response
 * @returns {void} nothing
 */
JobServer.prototype.echo = function (data) {
    if (!common.isString(data)) { return new Error('data to be echoed is not a text'); }

    packet = protocol.encodePacket(protocol.PACKET_TYPES.ECHO_REQ, [data]);
    this.send(packet);
}


/**
 * Sends the job server request to set an option for the connection in the job server.
 *
 * @method
 * @param {string} name name of the option to set
 * @returns {void} nothing
 */
JobServer.prototype.setOption = function (optionName) {
    if (!common.isString(optionName)) { return new Error('option is not a text'); }

    packet = protocol.encodePacket(protocol.PACKET_TYPES.OPTION_REQ, [optionName]);
    this.send(packet);
}


/**
 * Sends given data as Buffer through socket connection.
 * Underlaying socket connection with job server will be created when does not exist.
 *
 * @method
 * @param {Buffer} data to be sent
 * @param {function} callback called as error callback when sending failed (error as paramater) or success callback if sending OK (err=undefined)
 * @fires Client#error on associated client when something goes wrong
 * @fires Worker#error on associated worker when something goes wrong
 * @returns {void} nothing
 */
JobServer.prototype.send = function (data, callback) {
    var self = this;
    var connectCb, sendCb;

    // VALIDATION
    if (!(data instanceof Buffer)) { return new Error('data has to be object of Buffer'); }
    if (data.length < protocol.CONSTANTS.HEADER_LEN) { return new Error('short data'); }
    if (protocol.CONSTANTS.HEADER_REQ != data.readUInt32BE(0)) { return new Error('no gearman packet'); }

    // invoked after connection established
    connectCb = function (connectErr) {
        if (connectErr instanceof Error) { // if Error, the problem has been already propagated by this.socket.on('error', ...
            self.removeAllListeners('ConnectInternal140319214558'); // remove function waiting for connection
            if (callback instanceof Function) { callback(connectErr); }
        }
    };

    sendCb = function () {
        self.socket.write(data);
        if (JobServer.logger.isLevelEnabled('verbose')) {
            JobServer.logger.log('verbose', 'packet sent, type=%s, len=%d', protocol.PACKET_CODES[data.readUInt32BE(4)], data.length);
        }
        if (callback instanceof Function) { callback(); }
    };

    if (this.connected) {
        sendCb();
    } else {
        JobServer.logger.log('debug', 'unconnected job server, uid=%s', this.getUid());
        if (events.EventEmitter.listenerCount(this, 'ConnectInternal140319214558') == 0) { // connect only if there are no already waiting 'send' function (see BF #9)
            this.connect(connectCb);
        }
        this.once('ConnectInternal140319214558', sendCb);
    }
}


/**
 * Processes data received from socket.
 *
 * @method
 * @param {Buffer} chunk data readed from socket
 * @access private
 */
JobServer.prototype._processData = function (chunk) {
    if (!this.connected) {
        JobServer.logger.log('warn', 'trying to process data from disconnected job server (disconnect before all packet received?)');
        return;
    }

    if (chunk.length<protocol.CONSTANTS.HEADER_LEN) {//header is not enough
        this.headerfrag = nextChunk;
        return;
    }

    if (chunk.readUInt32BE(0) !== protocol.CONSTANTS.HEADER_RESP) {
        if (this.hasOwnProperty('segmentedPacket')) {
            chunk = Buffer.concat([this.segmentedPacket, chunk]);            
        } else if (this.hasOwnProperty('headerfrag')) {
            chunk = Buffer.concat([this.headerfrag, chunk]);
            delete this.headerfrag;
        } else{ // not previous packet stored to be concatenated -> it must be error
            // OUT OF SYNC!
            this.clientOrWorker._unrecoverableError('out of sync with server');
            return;
        }
    }

    var packetType = chunk.readUInt32BE(4);
    var packetCode = protocol.PACKET_CODES[packetType];
    var responseLength = protocol.CONSTANTS.HEADER_LEN + chunk.readUInt32BE(8);

    // store chunk if data is segmented into more packets to be concatenated later
    if (chunk.length < responseLength) {
        if (JobServer.logger.isLevelEnabled('verbose')) {
            JobServer.logger.log('verbose', 'segmented packet found, responseSize=%d, packetLen=%d', responseLength, chunk.length);
        }
        this.segmentedPacket = chunk;
        return;
    }

    // split chunk if there are more responses in one packet
    if (chunk.length > responseLength) {
        if (JobServer.logger.isLevelEnabled('verbose')) {
            JobServer.logger.log('verbose', 'joined packet found, responseSize=%d, packetLen=%d', responseLength, chunk.length);
        }
        nextChunk = new Buffer(chunk.slice(responseLength));
        if (nextChunk.length>=protocol.CONSTANTS.HEADER_LEN) {//header complete
            var self = this;
            process.nextTick(function() {
                self._processData(nextChunk);
            });
        } else{//header is not enough
            this.headerfrag = nextChunk;
        }

        chunk = chunk.slice(0, responseLength);
    }

    // parse packet if it is a response
    var parsedPacket;
    if (protocol.DEFINITION[packetCode] !== undefined
        && (protocol.CONSTANTS.TYPE_RESP & protocol.DEFINITION[packetCode][1])) {
        delete this.segmentedPacket; // clear cached previous segments if exist or not
        parsedPacket = protocol.parsePacket(chunk, protocol.DEFINITION[packetCode][2]);
    }


    var handle, job, processed, status;

    switch (packetType) {

    // CLIENT/WORKER ==========================================================

    case protocol.PACKET_TYPES.ERROR:
        JobServer.logger.log('warn', 'job server error, uid=%s, code=%s, msg=%s',
            this.getUid(), parsedPacket[1], parsedPacket[2]);

        this.clientOrWorker.emit('jobServerError', this.getUid(), parsedPacket[1], parsedPacket[2]); // trigger event
        this.emit('jobServerError', parsedPacket[1], parsedPacket[2]); // trigger event
        break;

    case protocol.PACKET_TYPES.ECHO_RES:
    case protocol.PACKET_TYPES.OPTION_RES:
        this.emit(packetType === protocol.PACKET_TYPES.ECHO_RES ? 'echo' : 'option', parsedPacket[1]);
        break;


    // CLIENT =================================================================

    case protocol.PACKET_TYPES.JOB_CREATED:
        handle = parsedPacket[1];

        // remove it from queue of jobs waiting for JOB_CREATED
        if (this.jobsWaiting4Created.length === 0) {
            this.clientOrWorker._unrecoverableError('empty stack of job waiting 4 packet JOB_CREATED');
            return;
        }
        job = this.jobsWaiting4Created.shift();
        job.handle = handle;

        // and put it into hash of created jobs on Client
        this.clientOrWorker.jobs[job.getUid()] = job;

        if (this.jobsWaiting4Created.length === 0) {
            JobServer.logger.log('debug', 'no more a job waiting 4 state JOB_CREATED');
        }

        this.clientOrWorker._response(this, packetType, parsedPacket);
        break;

    case protocol.PACKET_TYPES.WORK_COMPLETE:
    case protocol.PACKET_TYPES.WORK_DATA: // for non-background jobs, the server forwards this packet from the worker to clients (Gearman Docu)
    case protocol.PACKET_TYPES.WORK_WARNING: // for non-background jobs, the server forwards this packet from the worker to clients (Gearman Docu)
    case protocol.PACKET_TYPES.STATUS_RES: // for background jobs in response to a GET_STATUS request (Gearman Docu)
    case protocol.PACKET_TYPES.WORK_STATUS: // for non-background jobs, the server forwards this packet from the worker to clients (Gearman Docu)
    case protocol.PACKET_TYPES.WORK_FAIL: // for non-background jobs, the server forwards this packet from the worker to clients (Gearman Docu)
    case protocol.PACKET_TYPES.WORK_EXCEPTION: // for non-background jobs, the server forwards this packet from the worker to clients (Gearman Docu)

        this.clientOrWorker._response(this, packetType, parsedPacket);
        break;

    // WORKER =================================================================

    case protocol.PACKET_TYPES.NOOP:
    case protocol.PACKET_TYPES.JOB_ASSIGN:
    case protocol.PACKET_TYPES.JOB_ASSIGN_UNIQ:
    case protocol.PACKET_TYPES.NO_JOB:

        this.clientOrWorker._response(this, packetType, parsedPacket);
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
 * Gets an unique identifier of job server represented by the URL address.
 *
 * @method
 * @returns {string} unique identifier
 */
JobServer.prototype.getUid = function () { // #unit: not needed
    return this.host + ':' + this.port;
}


/**
 * Returns a human readable string representation of the object.
 *
 * @method
 * @returns {string} object description
 */
JobServer.prototype.toString = function () { // #unit: not needed
    return 'JobServer(' + this.getUid() + ')';
}
