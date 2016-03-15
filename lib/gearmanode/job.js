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
 * @class Job
 * @classdesc A warapper representing a gearman task (job).
 * @constructor
 *
 * @param options literal representing the job
 * @param {string} options.name job name
 * @param {Buffer|string} options.payload job data
 * @param {string} options.unique unique identifiter for this job, the identifier is assigned by the client, Optional
 * TODO complete all parameters
 */
var Job = exports.Job = function (clientOrWorker, options) {
    var self = this;
    var pattern, returned;

    options = options || {};

    this.uuid = common.createUUID();

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

    // Client =========================
    if (this.clientOrWorker._type === 'Client') {
        // VALIDATION
        common.mixin({
            background: false, priority: 'NORMAL', toStringEncoding: 'optional', encoding: 'utf8' }, pattern); // TODO remove 'encoding' in next release after 03/2015
        returned = common.verifyAndSanitizeOptions(options, pattern);
        if (returned instanceof Error) { return returned; }
        returned = common.verifyOptions(
            { background: options.background, priority: options.priority, encoding: options.encoding },
            { background: [true, false], priority: ['LOW', 'NORMAL', 'HIGH'], encoding: ['utf8', 'ascii'] }
        );
        if (returned instanceof Error) { return returned; }
        // validate encoding
        if (options.toStringEncoding && !Buffer.isEncoding(options.toStringEncoding)) {
            return new Error('invalid encoding: ' + options.toStringEncoding);
        }
        if (options.toStringEncoding) {
            this.toStringEncoding = options.toStringEncoding;
        }

        this.background = options.background;
        this.priority = options.priority;
        if (options.hasOwnProperty('unique')) {
            this.unique = options.unique;
        }
        this.encoding = options.encoding; // TODO remove 'encoding' in next release after 03/2015
        // timeout

        this.processing = false;
    }

    // Worker =========================
    if (this.clientOrWorker._type === 'Worker') {
        // VALIDATION
        common.mixin({ handle: 'mandatory', jobServerUid: 'mandatory' }, pattern);
        returned = common.verifyAndSanitizeOptions(options, pattern);
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
    if (this.hasOwnProperty('processing')) { // [Client]
        this.processing = false;
    }
    if (this.hasOwnProperty('clientOrWorker')) {
        if (this.clientOrWorker.hasOwnProperty('jobs')) { // [Client] delete this job list in case of Client
            delete this.clientOrWorker.jobs[this.getUid()];
        }
        // AAA delete this.clientOrWorker; // bidirectional association management
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
 *
 * @method
 * @returns {string} object description
 */
Job.prototype.toString = function() { // #unit: not needed
    return 'Job(uuid=' + this.uuid + ', handle=' + this.handle + ', server=' + this.jobServerUid + ')';
}


/**
 * Returns unique identification of this job which consists of
 * job server UID, '_' delimiter and job handle.
 *
 * @method
 * @returns {string} unique identification of the job
 */
Job.prototype.getUid = function () { // #unit: not needed
    // if (!common.isString(this.handle) || !common.isString(this.jobServerUid)) {
    //     Job.logger.log('error', 'unknown handle or server, job=%s', this.toString());
    //     this.emit('error', new Error('unknown handle or server'));
    // }

    return this.jobServerUid + '#' + this.handle;
}
