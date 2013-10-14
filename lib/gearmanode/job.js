/*
 * This script introduces a class representing a Gearman job
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
var Job = exports.Job = function (clientOrWorker, options) {
    var self = this;
    var pattern, returned;

    options = options || {};

    if (!clientOrWorker || !clientOrWorker.hasOwnProperty('_type')) {
        return new Error('neither Client nor Worker reference');
    }

    // VALIDATION - common
    pattern = {
        name: 'mandatory', payload: 'mandatory', unique: 'optional'
    }
    returned = common.verifyOptions({ name: options.name, payload: options.payload }, pattern);
    if (returned instanceof Error) { return returned; }

    this.clientOrWorker = clientOrWorker;
    this.name = options.name;
    this.payload = options.payload;
    if (options.hasOwnProperty('unique')) {
        this.unique = options.unique;
    }

    // close itself if Client/Worker is closed
    this.clientOrWorker.once('close', function() {
        self.close();
    });

    // Client =========================
    if (this.clientOrWorker._type === 'Client') {
        // VALIDATION
        common.mixin({
            background: false, priority: 'NORMAL', encoding: 'utf8' }, pattern);
        returned = common.verifyAndSanitizeOptions(options, pattern);
        if (returned instanceof Error) { return returned; }
        returned = common.verifyOptions(
            { background: options.background, priority: options.priority, encoding: options.encoding },
            { background: [true, false], priority: ['LOW', 'NORMAL', 'HIGH'], encoding: ['utf8', 'ascii'] }
        );
        if (returned instanceof Error) { return returned; }

        this.background = options.background;
        this.priority = options.priority;
        if (options.hasOwnProperty('unique')) {
            this.unique = options.unique;
        }
        this.encoding = options.encoding;
        // timeout

        this.processing = false;
    }

    // Worker =========================
    if (this.clientOrWorker._type === 'Worker') {
        // VALIDATION
        common.mixin({ handle: 'mandatory', jobServerUid: 'mandatory' }, pattern);
        common.verifyAndSanitizeOptions(options, pattern);
        if (returned instanceof Error) { return returned; }

        this.handle = options.handle;
        this.jobServerUid = options.jobServerUid;
    }

    events.EventEmitter.call(this);
};

// inheritance
util.inherits(Job, events.EventEmitter);

// static logger
Job.logger = winston.loggers.get('Job');


/**
 * Closes the job for future processing by Gearman and releases this object's resources immediately.
 * Sets property 'closed' to 'true'.
 */
Job.prototype.close = function () {
    if (this.hasOwnProperty('processing')) { // in case of Client
        this.processing = false;
    }
    if (this.hasOwnProperty('clientOrWorker')) {
        if (this.clientOrWorker.hasOwnProperty('jobs')) { // delete this job list in case of Client
            delete this.clientOrWorker.jobs[this.handle];
        }
        delete this.clientOrWorker; // bidirectional association management
    }
    this.closed = true;
    this.emit('close'); // trigger event
    this.removeAllListeners();
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
    return 'Job(type=' + this.clientOrWorker._type + ',name=' + this.name
        + ',handle=' + this.handle + ',server=' + this.jobServerUid + ')';
}
