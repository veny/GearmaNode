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

//
// Expose core related prototypes.
//
// Gearman.Client      = require('./gearmanode/client').Client;

exports.Client = Client;


var c = exports.client();
c.submitJob({ name: 'reverse', payload: 'AHOJ' }, function(err, job) {
    job.on('submited', function() {
        console.log('--- Job#submited - ' + job.toString());
    });
    job.on('created', function() {
        console.log('--- Job#created - ' + job.toString());
    });
    job.on('complete', function() {
        console.log('--- Job#complete - ' + job.toString() + " >>> " + job.response);
        c.end();
    });
})
