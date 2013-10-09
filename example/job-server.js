/*
 * This script demonstrates how to:
 * 1) test or debug a job server with JobServer#echo
 * 2) set an option for the connection in the job server
 *
 * (C) 2013 Vaclav Sykora
 * Apache License, Version 2.0, http://www.apache.org/licenses/
 */

var gearmanode = require('../lib/gearmanode'),
    util       = require('util');

var client = gearmanode.client();
var js = client.jobServers[0];


// js.echo('ping', function(err, resp) {
// 	console.log('echo: response=' + resp);
// });

js.setOption('exceptions', function(err, resp) {
	console.log('setOption: err=' + err + ', response=' + resp);
});

// js.setOption('unknown_option', function(err, resp) {
// 	console.log('setOption: err=' + err + ', response=' + resp);
// });
