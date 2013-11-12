// start following CLI command before:
// > gearmand
// > gearmand -p 4731

var gearmanode = require('../lib/gearmanode');

//gearmanode.Client.logger.transports.console.level = 'info';
var limit = 300;
var timeout = 100;

// Foreground Job
var client = gearmanode.client({servers: [{}, {port: 4731}], loadBalancing: 'RoundRobin'});


function submitJobAndRegisterListeners(upto) {
	var job;

	if (upto >= limit) {
		console.log('<<< END');
		return; 
	}

	// random number between 1 and 10
	var a = Math.floor((Math.random() * 10) + 1);
	var b = Math.floor((Math.random() * 10) + 1);
	var data = a + ' ' + b;

	var method = a < 7 ? 'reverse' : 'add';

	job = client.submitJob(method, data);
	job.on('complete', function() {
	    console.log('RESULT >>> job=' + job.toString() + ', response=' + job.response);
	    if (method == 'add' && job.response != (a + b)) { console.log('ERROR (unexpected response) >>>'); }
	    if (method == 'reverse' && job.response != data.toString().split("").reverse().join("")) { console.log('ERROR (unexpected response) >>>'); }
	    job.close();
	});
	job.on('failed', function() {
	    console.log('FAILURE >>> ' + job.handle);
	    job.close();
	});

	setTimeout(function() {
		submitJobAndRegisterListeners(++upto);
	}, timeout);
}

submitJobAndRegisterListeners(0);
