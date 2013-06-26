/*
 * This script represents the entry point for Gearmanode: the Node.js binding for Gearman.
 *
 * (C) 2013 Vaclav Sykora
 * Apache License, Version 2.0, http://www.apache.org/licenses/
 *
 */


var winston = require('winston'),
    version = require('./gearmanode/version'),
    common  = require('./gearmanode/common'),
    Client  = require('./gearmanode/client').Client,
    Worker  = require('./gearmanode/worker').Worker;


winston.log('info', 'GearmaNode %s, running on Node.js %s [%s %s]',
    version.VERSION, process.version, process.platform, process.arch);


/**
 * Factory method for a client.
 */
exports.client = function (options) {
    var rslt = new Client(options);
    if (!(rslt instanceof Error)) {
        winston.log('info', 'client initialized with %d job server(s)', rslt.jobServers.length);
    }
    return rslt;
};


/**
 * Factory method for a worker.
 */
exports.worker = function (options) {
    var rslt = new Worker(options);
    if (!(rslt instanceof Error)) {
        winston.log('info', 'worker initialized with %d job server(s)', rslt.jobServers.length);
    }
    return rslt;
};


// Expose core related prototypes
exports.Client = Client;
exports.Worker = Worker;
exports.Job    = require('./gearmanode/job').Job;
