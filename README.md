            ____                                 _   _           _
           / ___| ___  __ _ _ __ _ __ ___   __ _| \ | | ___   __| | ___
          | |  _ / _ \/ _` | '__| '_ ` _ \ / _` |  \| |/ _ \ / _` |/ _ \
          | |_| |  __/ (_| | |  | | | | | | (_| | |\  | (_) | (_| |  __/
           \____|\___|\__,_|_|  |_| |_| |_|\__,_|_| \_|\___/ \__,_|\___|


Node.js library for the Gearman distributed job system.


## Features
* fully implemented Gearman Protocol
 * TODO (RESET_ABILITIES,SET_CLIENT_ID,CAN_DO_TIMEOUT,ALL_YOURS,GRAB_JOB_UNIQ,JOB_ASSIGN_UNIQ)
* support for multiple job servers
* load balancing strategy TODO
* recover time (when a server node is down due to maintenance or a crash, load balancer will use the recover-time as a delay before retrying the downed job server) TODO
* support for miscellaneous string encoding supported by Node.js `Buffer` class
* careful API documentation
* rock solid tests
 * currently more than 71 test scenarios and 250 asserts
* in depth tested with gearman clients and workers written in other languages (Ruby, PHP, Java)

## Usage
See [example](https://github.com/veny/GearmaNode/tree/master/example) folder.

### Client

    var gearmanode = require('gearmanode');
    var client = gearmanode.client(); // by default expects job server on localhost:4730
    client.submitJob({ name: 'reverse', payload: 'hello world!' }, function(err, job) { // by default foreground job with normal priority
        job.on('complete', function() {
            console.log(job.toString() + " >>> " + job.response);
            client.end();
        });
    })

### Multiple Job Servers

    // two servers: foo.com:4731, bar.com:4732
    client = gearmanode.client({ servers: [{host: 'foo.com', port: 4731}, {host: 'bar.com', port: 4732}] });
    // two servers with default values: foo.com:4730, localhost:4731
    client = gearmanode.client({ servers: [{host: 'foo.com'}, {port: 4731}] });


## Client events
* **submit** - when a job has been submited to job server, has parameter 'number of jobs waiting for response CREATED'
* **done** - when there's no submited job more waiting for state CREATED
* **connect** - when a job server connected (physical connection is lazy opened by first data sending), has parameter **job server UID**
* **disconnect** - when connection to a job server terminated (by timeout if not used or forcible by client), has parameter **job server UID**
* **error** - when an unrecoverable error occured (e.g. illegal client's state, malformed data, socket problem, ...) or job server encounters an error and needs to notify client, has parameter **Error**

## Job events
* **created** - when response to one of the SUBMIT_JOB* packets arrived and job handle assigned [Client]
* **status** - to update status information of a submitted jobs [Client]
 * in response to a client's request for a **background** job
 * status update propagated from worker to client in case of a **non-background** job
* **complete** - when the non-background job completed successfully [Client]
* **failed** - when a job has been canceled by invoking Job#reportError on worker side [Client]
* **exception** - when the job failed with the an exception, has parameter **text of exception** [Client]
* **timeout** - when the job has been canceled due to timeout [Client/Worker]
* **close** - when Job#close() called or when the job forcible closed by shutdown of client or worker [Client/Worker]
* **error** - when communication with job server failed [Client/Worker]

## Worker events
* **error** - when a fatal error occurred while processing job (e.g. illegal worker's state, socket problem, ...) or job server encounters an error and needs to notify client, has parameter **Error**

## Worker

    var worker = gearmanode.worker();
    worker.addFuntion('reverse', function (job) {
        var rslt = job.payload.toString().split("").reverse().join("");
        job.workComplete(rslt);
    });

A function the worker is able to perform can be registered via `worker#addFunction(name, callback, options)`
where `name` is a symbolic name of the function, `callback` is a function to be run when a job will be received
and `options` are additional options.

The worker function `callback` gets parameter `job` which is:

* job event emitter (see **Job events**)
* value object to turn over job's parameters
* interface to send job notification/information to the job server

The `job` object has methods as follows:

* name - getter for name of the function
* jobServerUid - getter for unique identification of job server that transmited the job
* handle - getter for job's handle
* payload - getter for received data (Buffer or String)
* workComplete - sends a notification to the server (and any listening clients) that the job completed successfully
* reportStatus - reports job's status to the job server
* reportWarning - sends a warning explicitly to the job server
* reportError - to indicate that the job failed
* reportException - to indicate that the job failed with exception (deprecated, provided for backwards compatibility)
* sendData - send data before job completes

The `options` can be:

* timeout - the timeout value, the job server will mark the job as failed and notify any listening clients
* toStringEncoding - if given received payload will be converted to `String` with this encoding, otherwise payload turned over as `Buffer`

## Tests

    > cd /path/to/repository
    > mocha

Make sure before starting the tests:

* job server is running on localhost:4730
* `mocha` test framework is installed


## Author

* vaclav.sykora@gmail.com
* https://plus.google.com/115674031373998885915
