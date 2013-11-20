var gearmanode = require('../lib/gearmanode');
var worker = gearmanode.worker();

worker.addFunction('reverse', function (job) {
    job.sendWorkData(job.payload); // mirror input as partial result
    job.workComplete(job.payload.toString().split("").reverse().join(""));
});
