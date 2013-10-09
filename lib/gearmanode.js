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
    job     = require('./gearmanode/job'),
    Client  = require('./gearmanode/client').Client,
    Worker  = require('./gearmanode/worker').Worker;


winston.log('info', 'GearmaNode %s, running on Node.js %s [%s %s]',
    version.VERSION, process.version, process.platform, process.arch);


/**
 * Factory method for a client.
 */
exports.client = function (options) {
    return new Client(options);
};


/**
 * Factory method for a worker.
 */
exports.worker = function (options) {
    return new Worker(options);
};


// Expose core related prototypes
exports.Client    = Client;
exports.Worker    = Worker;
exports.Job       = job.Job;
exports.WorkerJob = job.WorkerJob;


// TODOs
// - common stuff of Client/Worker can be mixed in
// - solve encoding problematic (Client/Worker/Job)
// - tests - make seperated section for events
// - API documentation