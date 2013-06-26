/*
 * This script introduces a class representing a Gearman job
 * that will be executed on a worker.
 *
 * (C) 2013 Vaclav Sykora
 * Apache License, Version 2.0, http://www.apache.org/licenses/
 *
 */

var winston  = require('winston'),
    util     = require('util'),
    events   = require('events'),
    protocol = require('./protocol'),
    common   = require('./common');


/**
 * *unique* unique identifiter for this job. The identifier is assigned by the client.
 */
var Job = exports.Job = function (options) {
    var pattern, returned;

    options = options || {};

    // VALIDATION
    pattern = {
        name: 'mandatory', payload: 'mandatory',
        background: false, priority: 'NORMAL',
        unique: 'optional', encoding: 'utf8'
    }
    returned = common.verifyAndSanitizeOptions(options, pattern);
    if (returned instanceof Error) { return returned; }
    returned = common.verifyOptions(
        { background: options.background, priority: options.priority, encoding: options.encoding },
        { background: [true, false], priority: ['LOW', 'NORMAL', 'HIGH'], encoding: ['utf8', 'ascii'] }
    );
    if (returned instanceof Error) { return returned; }

    this.payload = options.payload;
    this.name = options.name;
    this.background = options.background;
    this.priority = options.priority;
    if (options.hasOwnProperty('unique')) {
        this.unique = options.unique;
    }
    this.encoding = options.encoding;
    // timeout

    this.handle = null;
    this.processing = false;

    events.EventEmitter.call(this);
};

// inheritance
util.inherits(Job, events.EventEmitter);

// static logger
Job.logger = winston.loggers.get('Job');


/**
 * Encodes this job into a byte buffer according to given packet type
 * and job's encoding.
 */
Job.prototype.encode = function (packetType) {
    var packetLength, buff;
    var offset = 12;

    if (packetType === undefined) {
        packetType = this.getPacketType();
    }

    if (packetType == protocol.PACKET_TYPES.GET_STATUS) {
        packetLength = this.handle.length;
    } else {
        // SUBMIT_JOB_...
        // 'name' and 'unique' allowed only ASCII
        packetLength = Buffer.byteLength(this.name, this.encoding)
                + Buffer.byteLength(this.payload, this.encoding) + 2; // 2x NULL delimiter
        if (this.unique) {
            packetLength += Buffer.byteLength(this.unique, this.encoding);
        }
    }
    buff = new Buffer(offset + packetLength); // 12 byte header

    buff.writeUInt32BE(0x00524551, 0); // \0REQ
    buff.writeUInt32BE(packetType, 4);
    buff.writeUInt32BE(packetLength, 8);

    if (packetType == protocol.PACKET_TYPES.GET_STATUS) {
        buff.write(this.handle, offset);
    } else {
        // SUBMIT_JOB_...
        buff.write(this.name, offset, this.encoding);
        offset += Buffer.byteLength(this.name, this.encoding);
        buff.writeUInt8(0, offset); // NULL byte terminated function name
        offset ++;
        if (this.unique) { // NULL byte terminated unique ID
            buff.write(this.unique, offset, this.encoding);
            offset += Buffer.byteLength(this.unique, this.encoding);
        }
        buff.writeUInt8(0, offset);
        offset ++;

        buff.write(this.payload, offset, Buffer.byteLength(this.payload, this.encoding), this.encoding);
    }

    Job.logger.log('verbose', 'job request encoded, type=%s, buffer.size=%d',
        protocol.PACKET_CODES[packetType], buff.length);

    return buff;
};


/**
 * Closes the job for future processing by Gearman
 * and releases this object's resources immediately.
 * Sets property 'closed' to 'true'.
 */
Job.prototype.close = function () {
    this.processing = false;
    this.closed = true;
    if (this.client) {
        delete this.client.jobs[this.handle];
        delete this.client; // bidirectional association management
    }
    this.emit('close'); // trigger event
}


/**
 * Gets packet type for submiting a job. according to job's options.
 */
Job.prototype.getPacketType = function () {
    if (this.background) {
        if (this.priority == 'LOW') { return protocol.PACKET_TYPES.SUBMIT_JOB_LOW_BG; }
        if (this.priority == 'NORMAL') { return protocol.PACKET_TYPES.SUBMIT_JOB_BG; }
        if (this.priority == 'HIGH') { return protocol.PACKET_TYPES.SUBMIT_JOB_HIGH_BG; }
    } else {
        if (this.priority == 'LOW') { return protocol.PACKET_TYPES.SUBMIT_JOB_LOW; }
        if (this.priority == 'NORMAL') { return protocol.PACKET_TYPES.SUBMIT_JOB; }
        if (this.priority == 'HIGH') { return protocol.PACKET_TYPES.SUBMIT_JOB_HIGH; }
    }
};


/**
 * Returns a human readable string representation of the object.
 */
Job.prototype.toString = function() { // #unit: not needed
    return 'Job(name=' + this.name + ', handle=' + this.handle + ', processing=' + this.processing + ')';
}
