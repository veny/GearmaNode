
exports.encode = function (options) {
    options = options || {};
    // var type = options.type,
    //     p;

    // if (!(type in types.names)) {
    //     throw Error("unknown request type");
    // }

    // var arg = binary.parse(new Buffer(options.name, 'ascii')).
    //     word8(0). // NULL byte terminated function name
    //     word8(0). // NULL byte terminated unique ID
    //     put(options.data).
    //     buffer();

    // return binary.put().
    //     word8(0).
    //     put(REQ).
    //     word32be(types.names[type]).
    //     word32be(arg.length).
    //     put(arg).
    //     buffer();

    var data = new Buffer(options.data.toString(), 'utf-8');
    var packetLength = options.name.length + options.data.length + 2;
console.log("packetLength: " + packetLength);
    var buff = new Buffer(12 + packetLength); // 12 byte header

    buff.writeUInt32BE(0x00524551, 0); // \0REQ
    buff.writeUInt32BE(packetTypes.SUBMIT_JOB, 4);
    buff.writeUInt32BE(packetLength, 8);

    var offset = 12;
    buff.write(options.name, offset);
    offset += options.name.length;
    buff.writeUInt8(0, offset); // NULL byte terminated function name
    buff.writeUInt8(0, offset); // NULL byte terminated unique ID; TODO
    offset += 2;

    buff.write(options.data, offset);

    return buff;
};

var packetTypes = exports.packetTypes = {
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
