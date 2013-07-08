/*
 * This script introduces a classes representing a Gearman job
 * from both client's and worker's perspective.
 *
 * (C) 2013 Vaclav Sykora
 * Apache License, Version 2.0, http://www.apache.org/licenses/
 *
 */

var winston  = require('winston'),
    util     = require('util'),
    events   = require('events'),
    protocol = require('./protocol'),
    common   = require('./common');


/**
 * *options*
 *    *encoding* encosing to use, Optional
 *    *unique* unique identifiter for this job, the identifier is assigned by the client, Optional
 */
var Job = exports.Job = function (options) {
    var pattern, returned;

    options = options || {};

    // VALIDATION
    pattern = {
        name: 'mandatory', payload: 'mandatory',
        background: false, priority: 'NORMAL',
        unique: 'optional', encoding: 'utf8'
    }
    returned = common.verifyAndSanitizeOptions(options, pattern);
    if (returned instanceof Error) { return returned; }
    returned = common.verifyOptions(
        { background: options.background, priority: options.priority, encoding: options.encoding },
        { background: [true, false], priority: ['LOW', 'NORMAL', 'HIGH'], encoding: ['utf8', 'ascii'] }
    );
    if (returned instanceof Error) { return returned; }

    this.payload = options.payload;
    this.name = options.name;
    this.background = options.background;
    this.priority = options.priority;
    if (options.hasOwnProperty('unique')) {
        this.unique = options.unique;
    }
    this.encoding = options.encoding;
    // timeout

    this.handle = null;
    this.processing = false;

    events.EventEmitter.call(this);
};

// inheritance
util.inherits(Job, events.EventEmitter);

// static logger
Job.logger = winston.loggers.get('Job');


/**
 * Closes the job for future processing by Gearman
 * and releases this object's resources immediately.
 * Sets property 'closed' to 'true'.
 */
Job.prototype.close = function () {
    this.processing = false;
    this.closed = true;
    if (this.client) {
        delete this.client.jobs[this.handle];
        delete this.client; // bidirectional association management
    }
    this.emit('close'); // trigger event
}


/**
 * Gets packet type for submiting a job. according to job's options.
 */
Job.prototype.getPacketType = function () {
    if (this.background) {
        if (this.priority == 'LOW') { return protocol.PACKET_TYPES.SUBMIT_JOB_LOW_BG; }
        if (this.priority == 'NORMAL') { return protocol.PACKET_TYPES.SUBMIT_JOB_BG; }
        if (this.priority == 'HIGH') { return protocol.PACKET_TYPES.SUBMIT_JOB_HIGH_BG; }
    } else {
        if (this.priority == 'LOW') { return protocol.PACKET_TYPES.SUBMIT_JOB_LOW; }
        if (this.priority == 'NORMAL') { return protocol.PACKET_TYPES.SUBMIT_JOB; }
        if (this.priority == 'HIGH') { return protocol.PACKET_TYPES.SUBMIT_JOB_HIGH; }
    }
};


/**
 * Returns a human readable string representation of the object.
 */
Job.prototype.toString = function() { // #unit: not needed
    return 'Job(name=' + this.name + ', handle=' + this.handle + ', processing=' + this.processing + ')';
}




/**
 * *options*
 *    *handle
 *    *payload
 *    *name
 *    *jobServerUid
 *    *unique - unique identifiter for this job, the identifier is assigned by the client, Optional
 */
var WorkerJob = exports.WorkerJob = function (options) {
    var pattern, returned;

    options = options || {};

    // VALIDATION
    pattern = {
        name: 'mandatory', payload: 'mandatory', handle: 'mandatory', jobServerUid: 'mandatory',
        unique: 'optional'
    }
    returned = common.verifyAndSanitizeOptions(options, pattern);
    if (returned instanceof Error) { return returned; }

    this.name = options.name;
    this.handle = options.handle;
    this.payload = options.payload;
    this.jobServerUid = options.jobServerUid;
}


/**
 * Returns a human readable string representation of the object.
 */
WorkerJob.prototype.toString = function() { // #unit: not needed
    return 'WorkerJob(name=' + this.name + ',handle=' + this.handle + ',server=' + this.jobServerUid + ')';
}
