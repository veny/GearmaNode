
var gearmanode = require('../lib/gearmanode');


// Foreground Job
var worker = gearmanode.worker();
worker.addFunction('reverse', function (job) {
    job.sendWorkData(job.payload); // mirror input as partial result
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
