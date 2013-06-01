
var net    = require('net'),
    common = require('./common');


var JobServer = exports.JobServer = function (options) {
    var pattern = { host: 'mandatory', port: 'mandatory' };
    var returned = common.verifyOptions(options, pattern);
    if (returned instanceof Error) { return returned; }

    this.host = options.host;
    this.port = options.port;

    this.connected = false;
};


JobServer.prototype.getConnection = function (callback) {
    if (callback === undefined) { return new Error('no callback'); }

    var conn = this.connection;

    if (!this.connection) {
        this.connection = net.createConnection(jobServer.port, jobServer.host);
        this.connection.on('error', function (err) {
// console.log('!!!!!!!!!!! ' + util.inspect(data));
            callback(err);
        });

        this.connection.on('data', function (data) {
            decodedData = packet.decode(data);
            var type = decodedData.type;
            // debug("Recieved:", data);
            if (type in responses) { responses[type](data, client); }
        });

        this.connection = conn;
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