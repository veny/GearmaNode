/*
 * This script introduces a class representing a Gearman job
 * that will be executed on a worker.
 *
 * (C) 2013 Vaclav Sykora
 * Apache License, Version 2.0, http://www.apache.org/licenses/
 *
 */

var winston = require('winston');


var Job = exports.Job = function (options) {
    options = options || {};

    // static logger
    if (Job.logger === undefined) {
        Job.logger = winston.loggers.get('Job');
    }

    // VALIDATION
    var pattern = { name: 'mandatory', payload: 'mandatory', servers: 'optional', encoding: 'utf-8' }
    var returned = common.verifyAndSanitizeOptions(options, pattern);
    if (returned instanceof Error) { return returned; }

    this.payload = options.payload;
    this.name = options.name;
    this.encoding = options.encoding;
    // priority
    // FG v BG
    this.processing = false;

    this.statusCallbacks = [];
};


Job.prototype.encode = function () {
    var packetLength = this.name.length + this.payload.length + 2; // 2x NULL delimiter
    var buff = new Buffer(12 + packetLength); // 12 byte header

    buff.writeUInt32BE(0x00524551, 0); // \0REQ
    buff.writeUInt32BE(this._getPacketType(), 4);
    buff.writeUInt32BE(packetLength, 8);

    var offset = 12;
    buff.write(this.name, offset);
    offset += this.name.length; // TODO according to encoding
    buff.writeUInt8(0, offset); // NULL byte terminated function name
    offset ++;
    buff.writeUInt8(0, offset); // NULL byte terminated unique ID; TODO
    offset ++;

    buff.write(this.payload, offset);

    Job.logger.log('debug', 'job encoded to be sent, buffer.size=%d', buff.length);
// var out = '';
// for (var i = 0; i < buff.length; i ++) { out += (buff[i] + ' '); }
// console.log('buff = ' + out);

    return buff;
};


Job.prototype._getPacketType = function () {
    return Job.PACKET_TYPES.SUBMIT_JOB; //XXX
};


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
