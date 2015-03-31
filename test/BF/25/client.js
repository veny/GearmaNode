var gearmanode = require('gearmanode');

gearmanode.Client.logger.transports.console.level = 'error';

// hammer the server with repeated jobs with gearmanode as client
var client = gearmanode.client();
setInterval(function() {
    var job = client.submitJob(
        "wtf",
        JSON.stringify({"something": true}),
        {}
    );
    job.on('complete', function () {
        try {
            var response = JSON.parse(job.response);
        } catch (e) {
            // the response should always be valid json
            console.log("FAIL")
            console.log(job.response.toString())
            console.log(job);
            process.exit();
        }
        console.log("job %s complete", response.cnt);
     });
}, 20);