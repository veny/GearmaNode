
// start following CLI command before:
//  gearman -w -f reverse -- rev

var gearmanode = require('../lib/gearmanode');


// simplest sample for README.md - foreground job
var client = gearmanode.client(); // by default expects job server on localhost:4730
//client.submitJob({ name: 'sleep', payload: '4' }, function(err, job) { // by default foreground job with normal priority
client.submitJob({ name: 'reverse', payload: 'hello world!', background:false }, function(err, job) { // by default foreground job with normal priority
    job.on('complete', function() {
        console.log("RESULT >>> " + job.response);
        client.end();
    });
})


// var client = gearmanode.client();
// client.submitJob({ name: 'sleep', payload: '5', background: true }, function(err, job) {
//     job.on('submited', function() {
//         console.log('--- Job#submited - ' + job.toString());
//     });
//     job.on('created', function() {
//         console.log('--- Job#created - ' + job.toString());
//         setTimeout((function() {
//             console.log('wake-up')
//             job.getStatus(function() {});
//         }), 2000);
//         // If on of the BG versions is used, the client is not updated with
//         // status or notified when the job has completed (it is detached).
//         // if (job.background) {
//         //     c.end();
//         // }
//     });
//     job.on('complete', function() {
//         console.log('--- Job#complete - ' + job.toString() + " >>> " + job.response);
//         c.end();
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
//             c.end();
//         }
//     });
//     job.on('complete', function() {
//         console.log('--- Job#complete - ' + job.toString() + " >>> " + job.response);
//         c.end();
//     });
// })
