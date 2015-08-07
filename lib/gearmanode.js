// Copyright 2013 The GearmaNode Library Authors. All Rights Reserved.
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS-IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

/*
 * @fileoverview This script represents the entry point for Gearmanode: the Node.js binding for Gearman.
 * @author vaclav.sykora@google.com (Vaclav Sykora)
 * @exports gearmanode
 */

var winston = require('winston'),
    version = require('./gearmanode/version'),
    common  = require('./gearmanode/common'),
    job     = require('./gearmanode/job'),
    Client  = require('./gearmanode/client').Client,
    Worker  = require('./gearmanode/worker').Worker;


winston.log('info', 'GearmaNode %s, running on Node.js %s [%s %s], with pid %d',
    version.VERSION, process.version, process.platform, process.arch, process.pid);

/**
 * Winston logging extension:
 * This method represent a way to eliminate the cost constructing a logging message, string construction and concatenation,
 * regardless of whether the message is logged or not.
 *
 * @function
 * @param level logging level to be tested if enabled
 * @returns {booleam} flag whether given level enabled or not
 */
winston.Logger.prototype.isLevelEnabled = function(level) {
  for (key in this.transports) {
    var transportLevel = this.transports[key].level;
    if (this.levels[transportLevel] <= this.levels[level]) { return true; }
  }
  return false;
}

/**
 * Factory method for a client.
 *
 * @function
 * @param options see constructor of {@link Client}
 * @returns {Client} newly created client
 * @link Client
 */
exports.client = function (options) {
    return new Client(options);
};


/**
 * Factory method for a worker.
 *
 * @function
 * @param options see constructor of {@link Worker}
 * @returns {Worker} newly created worker
 * @link Worker
 */
exports.worker = function (options) {
    return new Worker(options);
};


// Expose core related prototypes
exports.Client    = Client;
exports.Worker    = Worker;
exports.Job       = job.Job;
