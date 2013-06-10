/*
 * This script introduces a class representing a Gearman job server
 * and knowledge about protocol to communicate with it.
 *
 * (C) 2013 Vaclav Sykora
 * Apache License, Version 2.0, http://www.apache.org/licenses/
 *
 */


var net      = require('net'),
    util     = require('util'),
    winston  = require('winston'),
    Job      = require('./job').Job,
    common   = require('./common');


var JobServer = exports.JobServer = function (options) {
    // static logger
    if (JobServer.logger === undefined) {
        JobServer.logger = winston.loggers.get('JobServer');
    }

    var pattern = { host: 'mandatory', port: 'mandatory' };
    var returned = common.verifyOptions(options, pattern);
    if (returned instanceof Error) { return returned; }

    this.host = options.host;
    this.port = options.port;

    this.connected = false;
    this.jobsSubmited = []; // submited jobs waiting for JOB_CREATED response
    this.jobs = {}; // jobs with ID waiting for WORK_COMPLETE
};


/**
 * Asynchronous method to establish a socket connection to a job server.
 * *callback* called when:
 *     * connection done with 'self' instance as argument
 *     * connection fails with an Error as argument
 */
JobServer.prototype.connect = function (callback) {
    var self = this;
    if (callback === undefined) { return new Error('no callback'); }

    if (!this.socket) {
        this.socket = net.createConnection(this.port, this.host);

        // fallback event registration
        var evNames = [ 'end', 'timeout', 'drain', 'close' ];
        evNames.forEach(function (name) {
            self.socket.on(name, function() {
                JobServer.logger.log('warn', 'unhandled event, name=%s', name);
            });
        });

        // emitted when a socket connection is successfully established
        this.socket.on('connect', function () {
            //self.socket.setKeepAlive(true); // TODO should be option in contructor
            self.connected = true;
            JobServer.logger.log('debug', 'connection established: ', self.toString('minimal'));
            callback(self);
        });

        // emitted when an error occurs
        this.socket.on('error', function (err) {
            self.socket.destroy();
            delete self.socket;
            self.connected = false; // TODO should be in 'close' event
            JobServer.logger.log('error', 'socket error', err);
            callback(err);
        });

        this.socket.on('data', function (chunk) {
            JobServer.logger.log('verbose', 'received packet, len=' + chunk.length);
            JobServer.logger.log('verbose', 'data: %s', common.bufferAsHex(chunk));

            self.processData(chunk, callback);
        });
    }

    return this.socket;
};


JobServer.prototype.disconnect = function () {
    // var i;

    if(this.connected){
        if(this.socket){
            try{
                this.socket.end();
            }catch(E){}
        }
        this.connected = false;

        // clear current jobs
        // for(i in this.currentJobs){
        //     if(this.currentJobs.hasOwnProperty(i)){
        //         if(this.currentJobs[i]){
        //             this.currentJobs[i].abort();
        //             this.currentJobs[i].emit("error", new Error("Job failed"));
        //         }
        //         delete this.currentJobs[i];
        //     }
        // }

        // // clear current workers
        // for(i in this.currentWorkers){
        //     if(this.currentWorkers.hasOwnProperty(i)){
        //         if(this.currentWorkers[i]){
        //             this.currentWorkers[i].finished = true;
        //         }
        //         delete this.currentWorkers[i];
        //     }
        // }

        // this.init();
    }
};


JobServer.prototype.submit = function (job) {
    var self = this;

    var afterConnect = function(arg) {
        if (arg instanceof Error) {
            // TODO
        } else {
            self.socket.write(job.encode(), job.encoding);
            job.processing = true;
            self.jobsSubmited.push(job);
            JobServer.logger.log('debug', 'job submited, name=%s', job.name);
        }
    };

    if (!this.connected) {
        JobServer.logger.log('debug', 'unconnected job server:', self.toString('minimal'));
        this.connect(afterConnect);
    } else {
        afterConnect(this);
    }
};


JobServer.prototype.processData = function (chunk, callback) {
    if (chunk.readUInt32BE(0) != 0x00524553) { // \0RES
        // OUT OF SYNC!
        var msg = 'out of sync with server';
        JobServer.logger.log('error', msg);
        // TODO close connection
        callback(new Error(msg));
        return;
    }

    var jobId, job;
    var proceed = 12;

    var packetType = chunk.readUInt32BE(4);
    // response needs to be 12 bytes + body length (job handle + payload)
    var packetLength = chunk.readUInt32BE(8);

    switch (packetType) {
    case Job.PACKET_TYPES.JOB_CREATED:
        jobId = Job.getJobId(chunk, 12, 12 + packetLength);
        job = this.jobsSubmited.pop(); // remove it from queue of jobs waiting for JOB_CREATED
        job.id = jobId;
        this.jobs[jobId] = job; // and put it into hash of created jobs
        proceed += packetLength;
        JobServer.logger.log('verbose', 'job created, jobId=%s', jobId);
        break;

    case Job.PACKET_TYPES.WORK_COMPLETE:
        // skip job handle => find next NULL
        var next0 = 12
        for (; next0 < chunk.length; next0 ++) {
            if (chunk.readUInt8(next0) == 0) {
                break;
            }
        }
        jobId = Job.getJobId(chunk, 12, next0);
        job = this.jobs[jobId];
        job.processing = false;
        delete this.jobs[jobId]; // remove it from hash of created jobs

        JobServer.logger.log('verbose', 'work complete, jobId=%s', jobId);
        next0 ++;
        job.response = chunk.toString(job.encoding, next0, 12 + packetLength);

        proceed += packetLength;
        JobServer.logger.log('debug', 'Result>>>> %s', job.response);
        break;

    default:
        JobServer.logger.log('warn', 'unknown packet, type=%d', packetType);
        proceed = chunk.length; // stop processing of rest of the chunk
    }

    if (proceed < chunk.length) { // when more packets in buffer
        this.processData(chunk.slice(proceed));
    }
}


JobServer.prototype.toString = function (how) {
    if (how == 'minimal') {
        return 'host=' + this.host + ', port=' + this.port;
    }
    return 'JobServer(' + this.toString('minimal') + ')';
}
