
var net      = require('net'),
    winston  = require('winston'),
    common   = require('./common');
    protocol = require('./protocol');


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

        this.socket.on('data', function (data) {
            var data = new Buffer(chunk && chunk.length || 0);
            // decodedData = packet.decode(data);
            // var type = decodedData.type;
            // // debug("Recieved:", data);
            // if (type in responses) { responses[type](data, client); }
        });
    }

    return this.connection;
};


JobServer.prototype.submit = function (job) {
    var encoding = 'utf-8';
    var data = protocol.encode(job);
    this.socket.write(data, job.encoding);
    // JobServer.logger.log('debug', 'Sent:', data);
//    client.lastJobSubmitted = this;
};
