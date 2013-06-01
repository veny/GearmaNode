
var net     = require('net'),
    winston = require('winston')
    common  = require('./common');


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
        this.connection = net.createConnection(this.port, this.host);

        // emitted when a socket connection is successfully established
        this.connection.on('connect', function (err) {
            JobServer.logger.log('info', 'connection established', { host: self.host, port: self.port });
        });

        // emitted when an error occurs
        this.connection.on('error', function (err) {
            JobServer.logger.log('error', 'connection failed', err);
            callback(err);
        });

        this.connection.on('data', function (data) {
            decodedData = packet.decode(data);
            var type = decodedData.type;
            // debug("Recieved:", data);
            if (type in responses) { responses[type](data, client); }
        });
    }

    return this.connection;
};


JobServer.prototype.submit = function () {
    var client = this.client,
        data = {
            name: this.name,
            data: this.data,
            encoding: this.encoding
        };

    // Set the type given the priority
    if (!(this.priority in priorities)) { throw Error("invalid priority"); }
    data.type = priorities[this.priority];

    // Append _BG to background jobs' type
    if (this.background) { data.type += "_BG"; }

    client.getConnection().write(packet.encode(data), this.encoding);
    debug("Sent:", data);
    client.lastJobSubmitted = this;
};