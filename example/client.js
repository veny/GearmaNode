
// start following CLI command before:
//  gearman -w -f reverse -- rev

var gearmanode = require('../lib/gearmanode');


var c = gearmanode.client();

c.submitJob({ name: 'reverse', payload: 'žluťoučký kůň', background: false, priority: 'HIGH' }, function(err, job) {
    job.on('submited', function() {
        console.log('--- Job#submited - ' + job.toString());
    });
    job.on('created', function() {
        console.log('--- Job#created - ' + job.toString());
        // If on of the BG versions is used, the client is not updated with
        // status or notified when the job has completed (it is detached).
        if (job.background) {
            c.end();
        }
    });
    job.on('complete', function() {
        console.log('--- Job#complete - ' + job.toString() + " >>> " + job.response);
        c.end();
    });
})
