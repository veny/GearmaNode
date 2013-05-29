/*
 * This script represents the entry point for Gearmanode: the Node.js binding for Gearman.
 *
 * (C) 2013 Vaclav Sykora
 * Apache License, Version 2.0, http://www.apache.org/licenses/
 *
 */



var winston = require('winston'),
    common  = require('./gearmanode/common'),
    version = require('./gearmanode/version');

winston.log('info', 'GearmaNode %s running...', version.VERSION);

module.exports = Gearman;

function Gearman(){
  this.workers = {};
}

Gearman.prototype.registerWorker = function(name, func){
    if(!this.workers[name]){
//        this.sendCommand("CAN_DO", name);
//        this.sendCommand("GRAB_JOB");
      winston.info('worker registered, name=%s', name)
    } else {
      winston.warn('deregistration of worker, name=%s', name)
    }
    this.workers[name] = func;
};



var gearman = new Gearman();
gearman.registerWorker("reverse", function(payload, worker){
    if(!payload){
        worker.error();
        return;
    }
    var reversed = payload.toString("utf-8").split("").reverse().join("");

    // delay for 1 sec before returning
    setTimeout(function(){
        worker.end(reversed);
    },1000);

});
