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
    // static logger
    if (Job.logger === undefined) {
        Job.logger = winston.loggers.get('Job');
    }

    options = options || {};

    // VALIDATION
    var pattern = {
        name: 'mandatory', payload: 'mandatory',
        background: false, priority: 'NORMAL',
        unique: 'optional', encoding: 'utf8'
    }
    var returned = common.verifyAndSanitizeOptions(options, pattern);
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

Job.prototype.__proto__ = events.EventEmitter.prototype;


Job.prototype.encode = function (packetType) { // #unit: TODO test it
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
        packetLength = this.name.length + Buffer.byteLength(this.payload, this.encoding) + 2; // 2x NULL delimiter
        if (this.unique) {
            packetLength += this.unique.length;
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
        buff.write(this.name, offset);
        offset += this.name.length;
        buff.writeUInt8(0, offset); // NULL byte terminated function name
        offset ++;
        if (this.unique) { // NULL byte terminated unique ID
            buff.write(this.unique, offset);
            offset += this.unique.length;
        }
        buff.writeUInt8(0, offset);
        offset ++;

        buff.write(this.payload, offset, Buffer.byteLength(this.payload, this.encoding), this.encoding);
    }

    Job.logger.log('verbose', 'job request encoded, type=%d, buffer.size=%d', packetType, buff.length);

    return buff;
};


/**
 * Closes the job for future precessing by Gearman
 * and releases this object's resources immediately.
 */
Job.prototype.close = function () { // #unit: TODO test it
    this.processing = false;
    if (this.client) {
        delete this.client.jobs[this.handle];
        delete this.client; // bidirectional association management
    }
    this.emit('close'); // trigger event
}

/**
 * Gets status of this background job.
 *
 * *callback(err)* called as
 *     * error callback when anything goes wrong
 *     * success callback when status obtained, err=undefined
 *
 * See Gearman Documentation:
 * --------------------------
 * This is used by clients that have submitted a job with SUBMIT_JOB_BG to see if the
 * job has been completed, and if not, to get the percentage complete.
 */
Job.prototype.XXXgetStatus = function () {

//    this.jobServer.socket.write(this.encode(protocol.PACKET_TYPES.GET_STATUS), 'ascii');
}


/**
 * Gets type of gearman's packet according to options.
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
