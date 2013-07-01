
// start following CLI command before:
//  gearman -w -f reverse -- rev

var gearmanode = require('../lib/gearmanode'),
    util       = require('util');


// simplest sample for README.md - foreground job waiting for completition
var client = gearmanode.client({port:4370}); // by default expects job server on localhost:4730
client.submitJob({ name: 'reverse', payload: 'hello world!' }, function(err, job) { // by default foreground job with normal priority
    job.on('complete', function() {
        console.log("RESULT >>> " + job.response);
        client.close();
    });
})


// simplest sample for README.md - foreground job receiving status update
// var client = gearmanode.client();
// client.submitJob({ name: 'sleep', payload: '3' }, function(err, job) {
//     job.on('status', function(result) {
//         console.log('STATUS >> ' + util.inspect(result));
//     });
//     job.on('complete', function() {
//         console.log("RESULT >>> " + job.response);
//         client.close();
//     });
// })


// var timeout = 3000;
// var client = gearmanode.client();
// client.submitJob({ name: 'sleep', payload: '5', background: true }, function(err, job) {
//     job.on('created', function() {
//         console.log('--- Job#created - ' + job.toString());
//         console.log('waiting for wake-up ' + timeout + '[ms] ...')
//         setTimeout((function() {
//             client.getStatus(job);
//         }), timeout);
//     });
//     job.on('status', function(result) {
//         console.log('--- result: ' + util.inspect(result));
//         client.close();
//     });
// })


// var c = gearmanode.client();
// c.submitJob({ name: 'reverse', payload: 'žluťoučký kůň', background: false, priority: 'HIGH' }, function(err, job) {
//     job.on('submited', function() {
//         console.log('--- Job#submited - ' + job.toString());
//     });
//     job.on('created', function() {
//         console.log('--- Job#created - ' + job.toString());
//         // If on of the BG versions is used, the client is not updated with
//         // status or notified when the job has completed (it is detached).
//         if (job.background) {
//             c.close();
//         }
//     });
//     job.on('complete', function() {
//         console.log('--- Job#complete - ' + job.toString() + " >>> " + job.response);
//         c.close();
//     });
// })
