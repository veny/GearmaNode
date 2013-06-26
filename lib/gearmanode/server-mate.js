
var util          = require('util'),
    common        = require('./common'),
    JobServer     = require('./job-server').JobServer;

var ServerMate = exports.ServerMate = function(options) {
    var pattern, returned, jobServer;

    options = options || {};

    // VALIDATION
    pattern = { host: 'localhost', port: 4730, servers: 'optional' }
    returned = common.verifyAndSanitizeOptions(options, pattern);
    if (returned instanceof Error) { return returned; }

    if (options.hasOwnProperty('servers')) {
        if (!util.isArray(options.servers)) {
            return new Error('servers: not an array');
        }
        if (options.servers.length === 0) {
            return new Error('servers: empty array');
        }
    } else { // fake servers if only single server given
        options.servers = [{ host: options.host, port: options.port }];
    }

    this.jobServers = [];

    pattern = { host: 'localhost', port: 4730 };
    for (var i = 0; i < options.servers.length; i ++) {
        common.verifyAndSanitizeOptions(options.servers[i], pattern);
        jobServer = new JobServer(options.servers[i]);

        // assert whether no duplicate server
        if (!this.jobServers.every(function(el) { return el.getUid() != jobServer.getUid(); })) {
            return new Error('duplicate server, uid=' + jobServer.getUid());
        }
        // only paranoia
        if (jobServer instanceof Error) { return jobServer; }

        this.jobServers.push(jobServer);
    }

}


/**
 * Gets a JobServer object according to given UID or 'null' if not found.
 */
ServerMate.prototype.getJobServerByUid = function (uid) { // #unit: not needed
    var i;
    for (i = 0; i < this.jobServers.length; i ++) {
        if (uid == this.jobServers[i].getUid()) {
            return this.jobServers[i];
        }
    }
    return null;
}
