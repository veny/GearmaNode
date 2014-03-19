
var gearmanode = require('../lib/gearmanode');


// Foreground Job
// var worker = gearmanode.worker();
// worker.addFunction('reverse', function (job) {
//     job.sendWorkData(job.payload); // mirror input as partial result
//     var rslt = job.payload.toString().split("").reverse().join("");
//     job.workComplete(rslt);
// });


// Foreground Job with Timeout
// var worker = gearmanode.worker();
// worker.addFunction('reverse', function (job) {
//     console.log("payload>>> " + job.payload);
//     setTimeout(function() {
//         console.log('WAKE UP');
//         var rslt = job.payload.toString().split("").reverse().join("");
//         job.workComplete(rslt);
//     }, 12000);
// }, {timeout: 10});


// Foreground Job with Client ID
var worker = gearmanode.worker();
worker.setWorkerId('FooBazBar');
worker.addFunction('reverse', function (job) {
    console.log("payload>>> " + job.payload);
    var rslt = job.payload.toString().split("").reverse().join("");
    job.workComplete(rslt);
});


// Background Job
// var worker = gearmanode.worker();
// worker.addFunction('sleep', function (job) {
//     var seconds = new Number(job.payload);
//     var cnt = 0;
//     var tmo = function() {
//         if (cnt < seconds) {
//             cnt ++;
//             console.log('== sleep: idx=' + cnt + ', ' + job.toString());
//             job.reportStatus(cnt, seconds);
//             setTimeout(tmo, 1000);
//         } else {
//             job.workComplete();
//         }
//     }
//     tmo();
// });


// Job#reportError (for background jobs)
// var worker = gearmanode.worker();
// worker.addFunction('reverse', function (job) {
// //    job.reportError();
// //    job.reportException('delta alfa');
//     job.reportWarning('delta alfa');
//     job.workComplete('OIIUSHDF');
// });
