var numCompleted = 0;
var bytesRecieved = 0;

function completeNodeGearman (data) {
    numCompleted++;
    bytesRecieved+= data.length;
}

function completeGearmaNode () {
    numCompleted++;
    bytesRecieved+= this.response.length;
}

setTimeout(function() {
    function fileSizeSI(a,b,c,d,e){
         return (b=Math,c=b.log,d=1e3,e=c(a)/c(d)|0,a/b.pow(d,e)).toFixed(2)+' '+(e?'kMGTPEZY'[--e]+'B':'Bytes')
    }
    console.log(
        "completed %d jobs and %s of payload",
        numCompleted,
        fileSizeSI(bytesRecieved)
    );
    process.exit();
}, 10*1000);

var jobName;
jobName = 'cnt';
jobName = '1K';
jobName = '10K';
jobName = '100K';
jobName = '1M';

var binding = process.argv[2]
if ('GearmaNode' === binding) {
    console.log('Binding: %s, jobName: %s', binding, jobName);
    var gearmanode = require('gearmanode');
    gearmanode.Client.logger.transports.console.level = 'error';
    var client = gearmanode.client();
    setInterval(function() {
        var job = client.submitJob(jobName, "");
        job.on('complete', completeGearmaNode);
    }, 1);
} else if ('node-gearman' === binding) {
    console.log('Binding: %s, jobName: %s', binding, jobName);
    var NodeGearman = require('node-gearman');
    var nodegearman = new NodeGearman();
    setInterval(function() {
        var job = nodegearman.submitJob(jobName, "");
        job.on("data", completeNodeGearman);
    }, 1);
} else {
    console.log('Unknown binding!');
    process.exit();
}