var gearmanode = require('../../../lib/gearmanode');

// worker for BF#5
var worker = gearmanode.worker();
worker.addFunction('reverse', function (job) {
    var rslt = job.payload.toString().split("").reverse().join("");
    console.log("id=" + job.handle + ", result=" + rslt);
    job.workComplete();
});
