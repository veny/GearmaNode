
var gearmanode = require('../lib/gearmanode');


// simplest sample for README.md
var worker = gearmanode.worker();
worker.addFuntion('reverse', function (job) {
    var rslt = job.payload.split("").reverse().join("");
    job.workComplete(rslt);
});

    //job.reportStatus(2, 3);
