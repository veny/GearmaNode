/*
 * This script represents implementation of load balancing strategy.
 *
 * (C) 2013 Vaclav Sykora
 * Apache License, Version 2.0, http://www.apache.org/licenses/
 *
 */

var util         = require('util'),
    winston      = require('winston'),
    common       = require('./common');
    JS_CONSTANTS = require('./job-server').CONSTANTS;


// After what time [s] can be a failed node reused in load balancing.
//DEFAULT_RECOVER_TIME = 30;


/**
 * Constructor.
 *
 * @params nodeCount count of nodes to be balanced
 */
var LBStrategy = function(nodeCount) {
    if (!common.isNumber(nodeCount)) { return new Error('count of nodes is not number'); }

    this.nodeCount = nodeCount;
    this.badNodes = {};
    this.recoverTime = JS_CONSTANTS.DEFAULT_RECOVER_TIME;
};

/** Static logger. */
LBStrategy.logger = winston.loggers.get('LBStrategy');


/**
 * Gets index of node to be used for next request.
 *
 * @return `null` if there is no one next
 */
LBStrategy.prototype.nextIndex = common.abstractMethod;


/**
 * Marks an index as good that means it can be used for next server calls.
 *
 * @param idx index to be marked as good
 */
LBStrategy.prototype.goodOne = function(idx) {
    delete this.badNodes[idx];
};


/**
 * Marks an index as bad that means it will be not used until:
 * * there is other 'good' node
 * * timeout
 *
 * @param idx index to be marked as good
 */
 LBStrategy.prototype.badOne = function(idx) {
    if (idx < this.nodeCount && common.isNumber(idx)) {
        this.badNodes[idx] = new Date();
    }
};


/**
 * Tries to find a new node if the given failed.
 *
 * @param badIdx index of bad node
 * @return `null` if no one found
 */
LBStrategy.prototype._searchNextGood = function (badIdx) {
    var candidate, timeoutCandidate = null, failureTime;
    LBStrategy.logger.log('warn', 'identified bad node, idx=%d, age=%d [ms]', badIdx, (this.badNodes[badIdx] - new Date()));

    for (var i = 0; i < this.nodeCount; i ++) {
        candidate = (i + badIdx) % this.nodeCount;

        if (this.badNodes.hasOwnProperty(candidate)) {
            // select a timeout based candidate
            failureTime = this.badNodes[candidate];
            if ((new Date() - failureTime) > this.recoverTime) {
              timeoutCandidate = candidate;
              LBStrategy.logger.log('debug', 'node timeout recovery, idx=%d', candidate);
              this.goodOne(candidate)
            }
        } else {
            LBStrategy.logger.log('debug', 'found good node, idx=%d', candidate);
            return candidate;
        }
    }

    // no good index found -> try timeouted one
    if (timeoutCandidate !== null) {
      LBStrategy.logger.log('debug', 'good node not found, delivering timeouted one, idx=%d', timeoutCandidate);
      return timeoutCandidate;
    }

    LBStrategy.logger.log('error', 'all nodes invalid, no candidate more');
    return null;
};



/**
 * Implementation of Sequence strategy.
 * Assigns work in the order of nodes defined by the client initialization.
 *
 * @params nodeCount count of nodes to be balanced
 */
var Sequence = exports.Sequence = function(nodeCount) {
    // parent constructor
    var returned = LBStrategy.call(this, nodeCount);
    if (returned instanceof Error) { return returned; }
};

// inheritance
util.inherits(Sequence, LBStrategy);


/**
 * @inheritedDoc
 */
Sequence.prototype.nextIndex = function () {
    if (this.lastIndex === null || this.lastIndex === undefined) { this.lastIndex = 0; }

    if (this.badNodes.hasOwnProperty(this.lastIndex)) {
        this.lastIndex = this._searchNextGood(this.lastIndex);
    }
    return this.lastIndex;
};



/**
 * Implementation of Round Robin strategy.
 * Assigns work in round-robin order per nodes defined by the client initialization.
 *
 * @params nodeCount count of nodes to be balanced
 */
var RoundRobin = exports.RoundRobin = function(nodeCount) {
    // parent constructor
    var returned = LBStrategy.call(this, nodeCount);
    if (returned instanceof Error) { return returned; }
};

// inheritance
util.inherits(RoundRobin, LBStrategy);


/**
 * @inheritedDoc
 */
RoundRobin.prototype.nextIndex = function () {
    if (this.lastIndex === null || this.lastIndex === undefined) { this.lastIndex = -1; }

    this.lastIndex = (this.lastIndex + 1) % this.nodeCount;
    if (this.badNodes.hasOwnProperty(this.lastIndex)) {
        this.lastIndex = this._searchNextGood(this.lastIndex);
    }
    return this.lastIndex;
}
