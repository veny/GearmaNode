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
    Job      = require('./job').Job;
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

    this.id = { host: this.host, port: this.port };
};


/**
 * Asynchronous method to establish a socket connection to a job server.
 * *callback* called when:
 *     * connection done with 'self' instance as argument
 *     * connection fails with an Error as argument
 */
JobServer.prototype.connect = function (callback) {
    if (callback === undefined) { return new Error('no callback'); }

    if (!this.socket) {
        var self = this;
        self.socket = net.createConnection(this.port, this.host);

        // fallback event registration
        var evNames = [ 'end', 'timeout', 'drain', 'close' ];
        evNames.forEach(function (name) {
            self.socket.on(name, function() {
                JobServer.logger.log('warn', 'unhandled event, name=%s', name);
            });
        });

        // emitted when a socket connection is successfully established
        self.socket.on('connect', function () {
            //self.socket.setKeepAlive(true); // TODO should be option in contructor
            self.connected = true;
            JobServer.logger.log('info', 'connection established: ', self.id);
            callback();
        });

        // emitted when an error occurs
        self.socket.on('error', function (err) {
            self.socket.destroy();
            delete self.socket;
            self.connected = false; // TODO should be in 'close' event
            JobServer.logger.log('error', 'socket error', err);
            callback(err);
        });

        self.socket.on('data', function (chunk) {
            // console.log('-- chunk.len=' + chunk.length + ', class=' + chunk.constructor.name);// + ', value=' + chunk.toString());
            // var out = ' ';
            // for (var i = 0; i < chunk.length; i ++) {
            //     out += (chunk.readUInt8(i) + ' ');
            // }
            // console.log('readed: ' + out);

            if (chunk.readUInt32BE(0) != 0x00524553) { // \0RES
                // OUT OF SYNC!
                //return new Error("Out of sync with server")); //XXX
                console.log('OUT OF SYNC!! ');
            }

            var packetType = chunk.readUInt32BE(4);
            // response needs to be 12 bytes + body length (job handle + payload)
            var packetLength = chunk.readUInt32BE(8);

            if (packetType === Job.PACKET_TYPES.WORK_COMPLETE) {
                // skip job handle => find next NULL
                for (var next0 = 12; next0 < chunk.length; next0 ++) {
                    if (chunk.readUInt8(next0) == 0) {
                        break;
                    }
                }
                JobServer.logger.log('debug', 'Result>>>> %s', chunk.toString('utf-8', next0));
            }
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

//     var afterConnect = function(arg) {
//         if (arg instanceof Error) {
//             // TODO
//         } else {
//             self.socket.write(job.encode(), job.encoding);
// console.log('11111111111111 ' + self.connected);
//             JobServer.logger.log('debug', 'job submited, name=%s', job.name);
//         }
//     };

//     if (!this.connected) {
//         JobServer.logger.log('debug', 'unconnected job server:', self.id);
//         this.connect(afterConnect);
//     } else {
// //        afterConnect(this);
//     }

    self.connect(function (arg) {
        console.log('CONNECT ');
    });
    self.socket.write(job.encode(), job.encoding);
};
