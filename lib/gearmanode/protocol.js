var net      = require('net'),
    util     = require('util'),
    winston  = require('winston'),
    Job      = require('./job').Job;

exports.getJobId = function (packet, start, end) {
    return packet.toString('ascii', start, end);
}