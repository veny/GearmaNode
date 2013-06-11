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


var Job = exports.Job = function (options) {
    // static logger
    if (Job.logger === undefined) {
        Job.logger = winston.loggers.get('Job');
    }

    options = options || {};

    // VALIDATION
    var pattern = {
        name: 'mandatory', payload: 'mandatory',
        background: false, priority: 'NORMAL', encoding: 'utf8'
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
    this.encoding = options.encoding;

    this.id = null;
    this.processing = false;

    events.EventEmitter.call(this);

    this.statusCallbacks = [];
};


Job.prototype.__proto__ = events.EventEmitter.prototype;


Job.prototype.encode = function () {
    var packetLength = this.name.length + this.payload.length + 2; // 2x NULL delimiter
    var buff = new Buffer(12 + packetLength); // 12 byte header

    buff.writeUInt32BE(0x00524551, 0); // \0REQ
    buff.writeUInt32BE(this._getPacketType(), 4);
    buff.writeUInt32BE(packetLength, 8);

    var offset = 12;
    buff.write(this.name, offset); // TODO encoding
    offset += this.name.length; // TODO according to encoding
    buff.writeUInt8(0, offset); // NULL byte terminated function name
    offset ++;
    buff.writeUInt8(0, offset); // NULL byte terminated unique ID; TODO(what about this?)
    offset ++;

    buff.write(this.payload, offset, Buffer.byteLength(this.payload, this.encoding), this.encoding);

    Job.logger.log('verbose', 'job encoded to be sent, buffer.size=%d', buff.length);

    return buff;
};


/**
 * Gets Job ID from given buffer starting and ending on given positions.
 */
Job.getJobId = function (packet, start, end) {
    return packet.toString('ascii', start, end);
}


/**
 * Aborts a job in a clean way.
 */
Job.prototype.abort = function () {
    this.processing = false;
    this.emit('aborted'); // trigger event
}


Job.prototype._getPacketType = function () {
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
Job.prototype.toString = function() {
    return 'Job(name=' + this.name + ', id=' + this.id + ', processing=' + this.processing + ')';
}


Job.PACKET_TYPES = {
    SUBMIT_JOB: 7,
    SUBMIT_JOB_HIGH: 21,
    SUBMIT_JOB_LOW: 33,
    SUBMIT_JOB_BG: 18,
    SUBMIT_JOB_HIGH_BG: 32,
    SUBMIT_JOB_LOW_BG: 34,
    GET_STATUS: 15,
    STATUS_RES: 20,
    JOB_CREATED: 8,
    WORK_COMPLETE: 13,
    WORK_FAIL: 14,
    WORK_EXCEPTION: 25,
    WORK_DATA: 28,
    WORK_WARNING: 29
};
