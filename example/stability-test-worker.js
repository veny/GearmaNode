// start following CLI command before:
// > gearmand
// > gearmand -p 4731


var gearmanode = require('../lib/gearmanode');

gearmanode.Worker.logger.transports.console.level = 'info';

var worker = gearmanode.worker({servers: [{}, {port: 4731}]});
//var worker = gearmanode.worker({port: 4731});


// Foreground Job
worker.addFunction('reverse', function (job) {
	console.log('>>> reverse: ' + job.handle + ', serverUid: ' + job.jobServerUid + ', payload: ' + job.payload)
    var rslt = job.payload.toString().split("").reverse().join("");
    job.workComplete(rslt);
});


// Background Job
worker.addFunction('add', function (job) {
	console.log('>>> add: ' + job.handle + ', serverUid: ' + job.jobServerUid + ', payload: ' + job.payload)
    var ab = job.payload.toString().split(' ');
    var a = new Number(ab[0]);
    var b = new Number(ab[1]);
    job.workComplete((a + b).toString());
});
