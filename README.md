            ____                                 _   _           _
           / ___| ___  __ _ _ __ _ __ ___   __ _| \ | | ___   __| | ___
          | |  _ / _ \/ _` | '__| '_ ` _ \ / _` |  \| |/ _ \ / _` |/ _ \
          | |_| |  __/ (_| | |  | | | | | | (_| | |\  | (_) | (_| |  __/
           \____|\___|\__,_|_|  |_| |_| |_|\__,_|_| \_|\___/ \__,_|\___|


Node.js library for the Gearman distributed job system.


## Features
* fully implemented Gearman Protocol TODO
* support for multiple job servers
* load balancing strategy TODO
* recover time (when a server node is down due to maintenance or a crash, load balancer will use the recover-time as a delay before retrying the downed job server) TODO
* rock solid tests
 * currently more than 50 test cases and 150 asserts
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
* **js_connect** - when a job server connected (physical connection is lazy opened by first data sending), has parameter **job server UID**
* **js_disconnect** - when connection to a job server terminated (by timeout if not used or forcible by client), has parameter **job server UID**
* **js_error** - when the Job Server encounters an error and needs to notify client TODO
* **error** - when an unrecoverable error occured (e.g. illegal client's state, malformed data, socket problem, ...), has parameter **Error**

## Job events
* **created** - when response to one of the SUBMIT_JOB* packets arrived and job handle assigned
* **status** - to update status information of a submitted jobs
 * in response to a client's request for a **background** job
 * status update propagated from worker to client in case of a **non-background** job
* **complete** - when the non-background job completed successfully
* **timeout** - when the job has been canceled due to timeout - TODO
* **close** - when Job#close() called or when the job forcible closed by shutdown of client
