
var net      = require('net'),
    winston  = require('winston'),
    Job      = require('./job').Job;
    common   = require('./common');


var JobServer = exports.JobServer = function (options) {
    var pattern = { host: 'mandatory', port: 'mandatory' };
    var returned = common.verifyOptions(options, pattern);
    if (returned instanceof Error) { return returned; }

    this.host = options.host;
    this.port = options.port;

    this.connected = false;
};


JobServer.prototype.connect = function (callback) {
    if (callback === undefined) { return new Error('no callback'); }

    // static logger
    if (JobServer.logger === undefined) {
        JobServer.logger = winston.loggers.get('JobServer');
    }

    if (!this.connection) {
        var self = this;
        this.socket = net.createConnection(this.port, this.host);

        // emitted when a socket connection is successfully established
        this.socket.on('connect', function () {
            self.socket.setKeepAlive(true);
            self.connected = true;
            JobServer.logger.log('info', 'connection established', { host: self.host, port: self.port });
        });

        // emitted when an error occurs
        this.socket.on('error', function (err) {
            JobServer.logger.log('error', 'connection failed', err);
            callback(err);
        });

        this.socket.on('data', function (chunk) {
            // console.log('-- chunk.len=' + chunk.length + ', class=' + chunk.constructor.name);// + ', value=' + chunk.toString());
            // var out = ' ';
            // for (var i = 0; i < chunk.length; i ++) {
            //     out += (chunk.readUInt8(i) + ' ');
            // }
            // console.log('readed: ' + out);

            if (chunk.readUInt32BE(0) != 0x00524553) { // \0RES
                // OUT OF SYNC!
                //return new Error("Out of sync with server")); //XXX
                console.log('OUT OF SYNC!! ');
            }

            var packetType = chunk.readUInt32BE(4);
            // response needs to be 12 bytes + body length (job handle + payload)
            var packetLength = chunk.readUInt32BE(8);

            if (packetType === Job.PACKET_TYPES.WORK_COMPLETE) {
                // skip job handle => find next NULL
                for (var next0 = 12; next0 < chunk.length; next0 ++) {
                    if (chunk.readUInt8(next0) == 0) {
                        break;
                    }
                }
                JobServer.logger.log('debug', 'Result>> %s', chunk.toString('utf-8', next0));
            }
        });
    }

    return this.connection;
};


JobServer.prototype.submit = function (job) {
    var encoding = 'utf-8';
    var data = job.encode();
    this.socket.write(data, job.encoding);
    // JobServer.logger.log('debug', 'Sent:', data);
};
