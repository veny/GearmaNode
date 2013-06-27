/*
 * This script represents an operator over Gearman protocol.
 * {@see http://gearman.org/protocol}
 *
 * (C) 2013 Vaclav Sykora
 * Apache License, Version 2.0, http://www.apache.org/licenses/
 *
 */


var winston = require('winston');


exports.PACKET_TYPES = {
    CAN_DO: 1,              // W->J: FUNC
    SUBMIT_JOB: 7,          // C->J: FUNC[0]UNIQ[0]ARGS
    JOB_CREATED: 8,         // J->C: HANDLE
    WORK_STATUS: 12,        // W->J/C: HANDLE[0]NUMERATOR[0]DENOMINATOR
    WORK_COMPLETE: 13,      // W->J/C: HANDLE[0]RES
    GET_STATUS: 15,         // C->J: HANDLE
    SUBMIT_JOB_BG: 18,      // C->J: FUNC[0]UNIQ[0]ARGS
    ERROR: 19,              // J->C: ERRCODE[0]ERR_TEXT
    STATUS_RES: 20,         // C->J: HANDLE[0]KNOWN[0]RUNNING[0]NUM[0]DENOM
    SUBMIT_JOB_HIGH: 21,    // C->J: FUNC[0]UNIQ[0]ARGS
    SUBMIT_JOB_HIGH_BG: 32, // C->J: FUNC[0]UNIQ[0]ARGS
    SUBMIT_JOB_LOW: 33,     // C->J: FUNC[0]UNIQ[0]ARGS
    SUBMIT_JOB_LOW_BG: 34,  // C->J: FUNC[0]UNIQ[0]ARGS
    // --
    WORK_FAIL: 14,
    WORK_EXCEPTION: 25,
    WORK_DATA: 28,
    WORK_WARNING: 29
};

exports.PACKET_CODES = {};
for (var i in exports.PACKET_TYPES) {
    exports.PACKET_CODES[exports.PACKET_TYPES[i]] = i;
}

var logger = winston.loggers.get('protocol');


/**
 * Parses given buffer according to defined format.
 *
 * *format*
 *   *N* NULL byte terminated string (encoding according to job's encoding)
 *   *n* NULL byte terminated string (ASCII encoding)
 *   *L* last segment of buffer (encoding according to job's encoding)
 *
 * return array
 *   *rslt[0]* number of processed bytes
 *   *rslt[1..]* chunks with order defined by format
 */
exports.parsePacket = function (buff, format) {
    var i, j, key;
    var rslt = [];
    var offset = 12; // packet header len
    var packetType = buff.readUInt32BE(4);
    var packetLength = offset + buff.readUInt32BE(8);

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
        } else if ('L' == key) { // LAST segment up to packetLength
            rslt[i + 1] = buff.toString(this.encoding, offset, packetLength);
            offset = packetLength;
        } else {
            return new Error('unknow format: ' + format);
        }
    }

    rslt[0] = offset;
    logger.log('debug', 'packet parsed, bytes=%d, type=%s', offset, exports.PACKET_CODES[packetType]);
    return rslt;
}


exports.encodePacket = function (packetType, encoding, args) {
    var i, buff;
    var packetLength = offset = 12;  // 12 byte header

    // compute packet length
    for (i = 0; i < args.length; i ++) {
        if (args[i].constructor.name === 'String') {
            packetLength += Buffer.byteLength(args[i], encoding);
        } else if (args[i].constructor.name === 'Buffer') {
            packetLength += args[i].length;
        } else {
            logger.log('warn', 'unrecognized argument to encode, class=%s', args[i].constructor.name);
            packetLength += Buffer.byteLength(args[i].toString(), encoding);
        }
    }
    packetLength += args.length - 1; // NULL byte terminations

    buff = new Buffer(packetLength);

    buff.writeUInt32BE(0x00524551, 0); // \0REQ
    buff.writeUInt32BE(packetType, 4);
    buff.writeUInt32BE(packetLength, 8);

    // construct packet
    for (i = 0; i < args.length; i ++) {
        if (args[i].constructor.name === 'String') {
            buff.write(args[i], offset, encoding);
            offset += Buffer.byteLength(args[i], encoding);
        } else if (args[i].constructor.name === 'Buffer') {
            args[i].copy(buff, offset);
            offset += args[i].length;
        } else {
            buff.write(args[i].toString(), offset, encoding);
            offset += Buffer.byteLength(args[i].toString(), encoding);
        }

        if (i < (args.length - 1)) {
            buff.writeUInt8(0, offset); // NULL byte terminated chunk
            offset ++;
        }
    }

    logger.log('debug', 'packet encoded, type=%s, buffer.size=%d', exports.PACKET_CODES[packetType], packetLength);
    return buff;
}
