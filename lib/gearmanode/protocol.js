/*
 * This script represents an operator over Gearman protocol.
 * {@see http://gearman.org/protocol}
 *
 * (C) 2013 Vaclav Sykora
 * Apache License, Version 2.0, http://www.apache.org/licenses/
 *
 */


var winston = require('winston'),
    util    = require('util');


// various constants used in protocol
var constants = exports.CONSTANTS = {
    TYPE_REQ: 1,
    TYPE_RESP: 2,
    // --
    HEADER_REQ: 0x00524551,
    HEADER_RESP: 0x00524553,
    HEADER_LEN: 12
};
var logger = winston.loggers.get('protocol');


exports.DEFINITION = {
    CAN_DO: [1, constants.TYPE_REQ],                // W->J: FUNC
    CANT_DO: [2, constants.TYPE_REQ],               // W->J: FUNC
    //RESET_ABILITIES
    PRE_SLEEP: [4, constants.TYPE_REQ],             // W->J: --
    // 5 (unused)
    NOOP: [6, constants.TYPE_RESP, ''],             // J->W: --
    SUBMIT_JOB: [7, constants.TYPE_REQ],            // C->J: FUNC[0]UNIQ[0]ARGS
    JOB_CREATED: [8, constants.TYPE_RESP, 'L'],     // J->C: HANDLE
    GRAB_JOB: [9, constants.TYPE_REQ],              // W->J: --
    NO_JOB: [10, constants.TYPE_RESP, ''],          // J->W: --
    JOB_ASSIGN: [11, constants.TYPE_RESP, 'nnb'],   // J->W: HANDLE[0]FUNC[0]ARG
    WORK_STATUS: [12, constants.TYPE_REQ | constants.TYPE_RESP, 'nnL'],     // W->J/C: HANDLE[0]NUMERATOR[0]DENOMINATOR
    WORK_COMPLETE: [13, constants.TYPE_REQ | constants.TYPE_RESP, 'nL'],    // W->J/C: HANDLE[0]RES
    WORK_FAIL: [14, constants.TYPE_REQ | constants.TYPE_RESP, 'L'],       // W->J/C: HANDLE
    GET_STATUS: [15, constants.TYPE_REQ],           // C->J: HANDLE
    SUBMIT_JOB_BG: [18, constants.TYPE_REQ],        // C->J: FUNC[0]UNIQ[0]ARGS
    ERROR: [19, constants.TYPE_RESP, 'nL'],         // J->C/W: ERRCODE[0]ERR_TEXT
    STATUS_RES: [20, constants.TYPE_RESP, 'nnnnL'], // C->J: HANDLE[0]KNOWN[0]RUNNING[0]NUM[0]DENOM
    SUBMIT_JOB_HIGH: [21, constants.TYPE_REQ],      // C->J: FUNC[0]UNIQ[0]ARGS
    SUBMIT_JOB_HIGH_BG: [32, constants.TYPE_REQ],   // C->J: FUNC[0]UNIQ[0]ARGS
    SUBMIT_JOB_LOW: [33, constants.TYPE_REQ],       // C->J: FUNC[0]UNIQ[0]ARGS
    SUBMIT_JOB_LOW_BG: [34, constants.TYPE_REQ],    // C->J: FUNC[0]UNIQ[0]ARGS
    // --
    ECHO_REQ: [16, constants.TYPE_RESP, ''],
    WORK_EXCEPTION: [25, constants.TYPE_REQ],
    WORK_DATA: [28, constants.TYPE_REQ],
    WORK_WARNING: [29, constants.TYPE_REQ]
};


// desc=>code - {CAN_DO: 1}
exports.PACKET_TYPES = {}
// code=>desc - {1: CAN_DO}
exports.PACKET_CODES = {};
// code=>format for RESP - {19: 'nL'}
exports.PACKET_RESP_FORMAT = {};


var def;
for (var i in exports.DEFINITION) {
    def = exports.DEFINITION[i];

    exports.PACKET_TYPES[i] = def[0];
    exports.PACKET_CODES[def[0]] = i;

    if (constants.TYPE_RESP === def[1]) {
        exports.PACKET_RESP_FORMAT[def[0]] = def[2];
    }
}


/**
 * Parses given buffer according to defined format.
 *
 * *format*
 *   *N* NULL byte terminated string (encoding according to job's encoding)
 *   *n* NULL byte terminated string (ASCII encoding)
 *   *L* last segment of buffer (encoding according to job's encoding)
 *   *b* last segment of buffer (as Buffer)
 *
 * return array
 *   *rslt[0]* number of processed bytes
 *   *rslt[1..]* chunks with order defined by format
 */
exports.parsePacket = function (buff, format) {
    var i, j, key;
    var rslt = [];
    var offset = constants.HEADER_LEN;
    var packetType = buff.readUInt32BE(4);
    var packetLength = offset + buff.readUInt32BE(8);

    format = format || '';

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
        } else if ('L' == key) { // LAST segment up to packetLength as String
            rslt[i + 1] = buff.toString(this.encoding, offset, packetLength);
            offset = packetLength;
        } else if ('b' == key) { // LAST segment up to packetLength as Buffer
            rslt[i + 1] = buff.slice(offset);
            offset = packetLength;
        } else {
            return new Error('unknow format: ' + format);
        }
    }

    rslt[0] = offset;
    logger.log('verbose', 'packet parsed, bytes=%d, type=%s', offset, exports.PACKET_CODES[packetType]);
    return rslt;
}


exports.encodePacket = function (packetType, encoding, args) {
    var i, buff;
    var packetLength = 0;
    var offset = constants.HEADER_LEN;

    // default values
    args = args || [];
    encoding = encoding || 'ascii';

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
    if (args.length > 0) {
        packetLength += args.length - 1; // NULL byte terminations
    }

    buff = new Buffer(constants.HEADER_LEN + packetLength);

    buff.writeUInt32BE(constants.HEADER_REQ, 0); // \0REQ
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

    logger.log('debug', 'packet encoded, type=%s, buffer.size=%d',
        exports.PACKET_CODES[packetType], packetLength + constants.HEADER_LEN);
    return buff;
}
