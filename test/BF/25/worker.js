var gearmanode = require('gearmanode');

gearmanode.Client.logger.transports.console.level = 'error';

// worker which returns a incrementing int
var cnt = 0;
var worker = gearmanode.worker();
worker.addFunction('wtf', function (job) {
    var response = {
        'cnt': ++cnt
    }
    console.log("counter: " + cnt);
    job.workComplete(JSON.stringify(response));
});