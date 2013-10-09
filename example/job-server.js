
var gearmanode = require('../lib/gearmanode'),
    util       = require('util');

var client = gearmanode.client();
var js = client.jobServers[0];

// js.echo('ping', function(err, resp) {
// 	console.log('echo: response=' + resp);
// });

js.setOption('exceptionsX', function(err, resp) {
	console.log('setOption: err=' + err + ', response=' + resp);
});
