
// start following CLI command before:
//  gearman -w -f reverse -- rev

var gearmanode = require('../lib/gearmanode'),
    util       = require('util');


// Foreground Job waiting for completition
var client = gearmanode.client();
var job = client.submitJob('reverse', 'hello world!');
//var job = client.submitJob('reverse', 'žluťoučký kůň');
job.on('workData', function(data) {
    console.log('WORK_DATA >>> ' + data);
});
job.on('complete', function() {
    console.log('RESULT >>> ' + job.response);
    client.close();
});
job.on('failed', function() {
    console.log('FAILURE >>> ' + job.handle);
    client.close();
});


// Foreground Job receiving status update
// var client = gearmanode.client();
// var job = client.submitJob('sleep', '3');
// job.on('status', function(result) {
//     console.log('STATUS >> ' + util.inspect(result));
// });
// job.on('complete', function() {
//     console.log("RESULT >>> " + job.response);
//     client.close();
// });


// Background Job asking for status
// var timeout = 3000;
// var client = gearmanode.client();
// var job = client.submitJob('sleep', '5', {background: true});
// job.on('created', function() {
//     console.log('--- Job#created - ' + job.toString());
//     console.log('--- waiting for wake-up ' + timeout + '[ms] ...')
//     setTimeout((function() {
//         job.getStatus(function(err){console.log('=========== ' + err)});
//     }), timeout);
// });
// job.on('status', function(result) {
//     console.log('--- result: ' + util.inspect(result));
//     client.close();
// });


// Foreground Job obtaining error/exception
// var client = gearmanode.client();
// //client.jobServers[0].setOption('exceptions', function(){});
// var job = client.submitJob('reverse', 'hi');
// job.on('complete', function() {
//     console.log('RESULT >>> ' + job.response);
//     client.close();
// });
// job.on('failed', function() {
//     console.log('FAILURE >>> ' + job.handle);
//     client.close();
// });
// job.on('exception', function(text) { // needs configuration of job server session (JobServer#setOption)
//     console.log('EXCEPTION >>> ' + text);
//     client.close();
// })
