var gearmanode = require('../../../lib/gearmanode');

// Background Job
for (var i = 1; i < 1000; i ++) {
    var client = gearmanode.client();
    var job = client.submitJob('reverse', 'hallo', {background: true});
    job.on('created', function() {
        console.log('--- Job#created - ' + job.toString());
    });
// job.on('status', function(result) {
//     console.log('--- result: ' + util.inspect(result));
//     client.close();
// });
}