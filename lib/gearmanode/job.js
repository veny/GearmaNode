
var winston = require('winston');


var Job = exports.Job = function (options) {

    // static logger
    if (Job.logger === undefined) {
        Job.logger = winston.loggers.get('Job');
    }

    this.payload = options.payload;
    this.name = options.name;

    this.encoding = 'utf-8';
    // priority
    // FG v BG

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
    offset += this.name.length;
    buff.writeUInt8(0, offset); // NULL byte terminated function name
    buff.writeUInt8(0, offset); // NULL byte terminated unique ID; TODO
    offset += 2;

    buff.write(this.payload, offset);

    Job.logger.log('debug', 'job encoded to be sent, packetLen=%d', buff.length);
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
