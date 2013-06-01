
exports.encode = function (job) {
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

    var packetLength = job.name.length + job.payload.length + 2;
console.log("packetLength: " + packetLength);
    var buff = new Buffer(12 + packetLength); // 12 byte header

    buff.writeUInt32BE(0x00524551, 0); // \0REQ
    buff.writeUInt32BE(job.getPacketType(), 4);
    buff.writeUInt32BE(packetLength, 8);

    var offset = 12;
    buff.write(job.name, offset);
    offset += job.name.length;
    buff.writeUInt8(0, offset); // NULL byte terminated function name
    buff.writeUInt8(0, offset); // NULL byte terminated unique ID; TODO
    offset += 2;

    buff.write(job.payload, offset);

    return buff;
};


// Takes a buffer and converts it to an object to be used
// exports.decode = function (buf) {
//     var o, data, size;

//     if (!(buf instanceof Buffer)) {
//         throw Error("input must be a Buffer");
//     }

//     o = binary.parse(buf).
//         word32bu("reqType").
//         word32bu("type").
//         word32bu("size").
//         tap(function (vars) { size = vars.size; }).
//         buffer("inputData", size).
//         vars;

//     // test if reqtype is valid, Buffer.compare?
//     for (var i = 0; i < o.reqType.length; i += 1) {
//         if (o.reqType[i] !== req[i]) {
//             throw Error("invalid request header");
//         }
//     }
//     o.type = types.numbers[o.type];
//     if (!o.type) { throw Error("must have a valid type"); }

//     // size is required
//     size = parseInt(o.size, 10);
//     if (isNaN(size) || size < 0) {
//         throw Error("packet length not sent");
//     }

//     o = responses[o.type](o);

//     ["reqType", "size", "inputData"].forEach(function (prop) {
//         delete o[prop];
//     });

//     return o;
// };


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
