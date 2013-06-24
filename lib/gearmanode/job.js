/*
 * This script introduces a class representing a Gearman job
 * that will be executed on a worker.
 *
 * (C) 2013 Vaclav Sykora
 * Apache License, Version 2.0, http://www.apache.org/licenses/
 *
 */

var winston = require('winston'),
    util    = require('util'),
    events  = require('events'),
    common  = require('./common');


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

    if (packetType == Job.PACKET_TYPES.GET_STATUS) {
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

    if (packetType == Job.PACKET_TYPES.GET_STATUS) {
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
 * Aborts a job in a clean way.
 */
Job.prototype.abort = function () {
    this.processing = false;
    if (this.jobServer) { // bidirectional association management
        delete this.jobServer;
    }
    delete this.handle;
    this.emit('aborted'); // trigger event
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
Job.prototype.getStatus = function (callback) {
    if (!(callback instanceof Function)) { callback(new Error('invalid callback (not a function)')); }
    if (!this.background) { callback(new Error('this is not a background job, no status')); }
    if (!this.jobServer) { callback(new Error('no jobServer (never ever submited job?)')); }

    if (!this.jobServer.connected) {
        callback(new Error('unconnected job server asked to send data'));
        return;
    }
    // TODO there should be method JobServer#send with above defined pre-condition
    this.jobServer.socket.write(this.encode(Job.PACKET_TYPES.GET_STATUS), 'ascii');
}


/**
 * Gets type of gearman's packet according to options.
 */
Job.prototype.getPacketType = function () {
    if (this.background) {
        if (this.priority == 'LOW') { return Job.PACKET_TYPES.SUBMIT_JOB_LOW_BG; }
        if (this.priority == 'NORMAL') { return Job.PACKET_TYPES.SUBMIT_JOB_BG; }
        if (this.priority == 'HIGH') { return Job.PACKET_TYPES.SUBMIT_JOB_HIGH_BG; }
    } else {
        if (this.priority == 'LOW') { return Job.PACKET_TYPES.SUBMIT_JOB_LOW; }
        if (this.priority == 'NORMAL') { return Job.PACKET_TYPES.SUBMIT_JOB; }
        if (this.priority == 'HIGH') { return Job.PACKET_TYPES.SUBMIT_JOB_HIGH; }
    }
};


/**
 * Returns a human readable string representation of the object.
 */
Job.prototype.toString = function() { // #unit: not needed
    return 'Job(name=' + this.name + ', handle=' + this.handle + ', processing=' + this.processing + ')';
}


Job.PACKET_TYPES = {
    SUBMIT_JOB: 7,
    SUBMIT_JOB_HIGH: 21,
    SUBMIT_JOB_LOW: 33,
    SUBMIT_JOB_BG: 18,
    SUBMIT_JOB_HIGH_BG: 32,
    SUBMIT_JOB_LOW_BG: 34,
    JOB_CREATED: 8,
    GET_STATUS: 15,
    STATUS_RES: 20,         // RES
    WORK_STATUS: 12,
    WORK_COMPLETE: 13,      // RES
    ERROR: 19,              // RES
    // --
    WORK_FAIL: 14,
    WORK_EXCEPTION: 25,
    WORK_DATA: 28,
    WORK_WARNING: 29
};
