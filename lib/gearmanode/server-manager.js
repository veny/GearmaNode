
var util      = require('util'),
    common    = require('./common'),
    JobServer = require('./job-server').JobServer;


/**
 * This class represents a mixin for Client and/or Worker
 * which adds functionality for manipulation with multiple job servers.
 *
 * (C) 2013 Vaclav Sykora
 * Apache License, Version 2.0, http://www.apache.org/licenses/
 *
 */
var ServerManager = exports.ServerManager = function () {};


ServerManager.prototype.init = function (clientOrWorker, options) {
    var pattern, returned, jobServer;

    if (!clientOrWorker) { return new Error('undefined target (client or worker)'); }

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

    clientOrWorker.jobServers = [];

    // iterate server definitions and instantiate JobServer
    pattern = { host: 'localhost', port: 4730 };
    for (var i = 0; i < options.servers.length; i ++) {
        common.verifyAndSanitizeOptions(options.servers[i], pattern);
        jobServer = new JobServer(options.servers[i]);

        // assert whether no duplicate server
        if (!clientOrWorker.jobServers.every(function(el) { return el.getUid() != jobServer.getUid(); })) {
            return new Error('duplicate server, uid=' + jobServer.getUid());
        }
        // only paranoia
        if (jobServer instanceof Error) { return jobServer; }

        jobServer.clientOrWorker = clientOrWorker; // bidirectional association management

        clientOrWorker.jobServers.push(jobServer);
    }
}


/**
 * Gets a JobServer object according to given UID or 'null' if not found.
 */
ServerManager.prototype._getJobServerByUid = function (uid) { // #unit: not needed
    var i;
    for (i = 0; i < this.jobServers.length; i ++) {
        if (uid === this.jobServers[i].getUid()) {
            return this.jobServers[i];
        }
    }
    return undefined;
}


/**
 * Mixin - augment the target constructor with the Foo functions.
 */
ServerManager.mixin = function (destinationCtor) {
    common.mixin(ServerManager.prototype, destinationCtor.prototype);
}