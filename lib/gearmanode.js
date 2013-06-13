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
    Client  = require('./gearmanode/client').Client;


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


// module.exports = Gearman;
//
// function Gearman() {
//     this.workers = {};
// };


// Expose core related prototypes
exports.Client = Client;
exports.Job    = require('./gearmanode/job').Job;
