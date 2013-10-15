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

// js.once('echo', function(resp) {
// 	console.log('ECHO: response=' + resp);
// 	client.close();
// });
// js.echo('ping')


// js.once('option', function(resp) {
// 	console.log('SET_OPTION: response=' + resp);
// 	client.close();
// });
// js.setOption('exceptions')


js.once('jobServerError', function(code, msg) {
	console.log('SET_OPTION: errCode=' + code +', message=' + msg);
	client.close();
});
js.setOption('unknown_option')
