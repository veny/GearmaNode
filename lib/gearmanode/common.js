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
 * @fileoverview This script represents a set of utilities, helpers and convenience functions for internal use.
 * @author vaclav.sykora@google.com (Vaclav Sykora)
 * @namespace gearmanode/common
 */

var util = require('util');


/**
 * Verifies given options against a pattern that defines checks applied on each option.
 * <br/>
 * Usage:<br/>
 * <code>verifyOptions(optionsToBeVerified, {foo: 'mandatory', bar: [true, false], baz: 'optional'});</code>
 *
 * @function verifyOptions
 * @memberof gearmanode/common
 * @param options object to be verified
 * @param pattern object where property is an expected option's property and value can be<ul>
 *  <li>'optional'  - corresponding option may or may not be presented
 *  <li>'mandatory' - corresponding option has to be presented
 *  <li>Array       - corresponding option has to be presented and value has to be in the given list
 * </ul>
 * @returns {error|object} error if expectation not accompished, otherwise the options
 */
exports.verifyOptions = function (options, pattern) {
    if (options === undefined || options == null) {
        return new Error('options not presented');
    }
    if (pattern === undefined || pattern == null) {
        return new Error('pattern not presented');
    }

    // unknown key?
    for (var key in options) {
        if (options.hasOwnProperty(key)) {
            if (!pattern.hasOwnProperty(key)) {
                return new Error('unknow option: ' + key);
            }

            // option in a set of allowed values
            if (util.isArray(pattern[key]) && pattern[key].indexOf(options[key]) === -1) {
                return new Error("value '" + options[key] + "' not in defined range, key=" + key);
            }
        }
    }

    // missing mandatory option?
    for (var key in pattern) {
        if (pattern.hasOwnProperty(key)) {
            if (pattern[key] === 'mandatory'
                && (!options.hasOwnProperty(key) || options[key] === undefined || options[key] == null)) {
                return new Error('missing mandatory option: ' + key);
            }
            if (util.isArray(pattern[key]) && !options.hasOwnProperty(key)) {
                return new Error('missing mandatory Array option: ' + key);
            }
        }
    }

    return options;
};


/**
 * The same as <code>verifyOptions</code> with opportunity to define default values
 * of paramaters that will be set if missing in options.
 * Special values are:<ul>
 *  <li>'null' which is considered as a desired value and will be NOT modified
 *  <li>'undefined' which is considered as a missing value and will be modified
 * </ul>
 * Usage:<br/>
 * <code>verifyAndSanitizeOptions(optionsToBeVerified, {foo: 'defaultValue', bar: 100});</code>
 *
 * @function verifyAndSanitizeOptions
 * @memberof gearmanode/common
 * @param options object to be verified
 * @param pattern object where property is an expected option's property and value can be<ul>
 *  <li>'optional'  - corresponding option may or may not be presented
 *  <li>'mandatory' - corresponding option has to be presented
 *  <li>Array       - corresponding option has to be presented and value has to be in the given list
 *  <li>other value - default value set into options of corresponding key missing
 * </ul>
 * @returns {error|object} error if expectation not accompished, otherwise the options
 */
exports.verifyAndSanitizeOptions = function (options, pattern) {
    var returned = this.verifyOptions(options, pattern);
    if (returned instanceof Error) { return returned; }

    // set default values if missing in options
    for (var key in pattern) {
        if (pattern.hasOwnProperty(key)) {
            if (pattern[key] !== undefined && pattern[key] !== 'optional'
                    && pattern[key] !== 'mandatory' && options[key] === undefined) {
                options[key] = pattern[key];
            }
        }
    }

    return options;
};


/**
 * Checks if the given value is a string literal or String object.
 *
 * @function isString
 * @memberof gearmanode/common
 * @param o object to be checked
 * @returns {boolean} <i>true</i> if the parameter is a string, otherwise <i>false</i>
 */
exports.isString = function (o) {
    return o !== undefined && o != null && (typeof o == 'string' || (typeof o == 'object' && o.constructor === String));
};


/**
 * Checks if the given value is a number literal or Number object.
 *
 * @function isNumber
 * @memberof gearmanode/common
 * @param o object to be checked
 * @returns {boolean} <i>true</i> if the parameter is a number, otherwise <i>false</i>
 */
exports.isNumber = function (o) {
    return o !== undefined && o != null && (typeof o == 'number' || (typeof o == 'object' && o.constructor === Number));
};


/**
 * Creates a shallow copy of an object.
 *
 * @function clone
 * @memberof gearmanode/common
 * @param o object to be copied
 * @returns shallow copy of the input argument
 */
exports.clone = function (from) {
    if (from !== Object(from)) { return from; } // not an object
    if (Array.isArray(from)) { return from.slice(); }
    return exports.mixin(from, {});
};


/**
 * Mixes in properties from source to destination
 * and so allows objects to borrow (or inherit) functionality from them with a minimal amount of complexity.
 *
 * @function mixin
 * @memberof gearmanode/common
 * @param source object where properties will be copied from
 * @param destination object where properties will be copied to
 * @returns the destination object
 */
exports.mixin = function (source, destination) { // #unit: TODO test it
  for (var k in source) {
    if (source.hasOwnProperty(k)) {
      destination[k] = source[k];
    }
  }
  return destination;
};


/**
 * Converts given buffer to space separated string of hexadecimal values of byte array.
 *
 * @function bufferAsHex
 * @memberof gearmanode/common
 * @param {Buffer} buffer to be converted
 * @returns {string} textual representation of given buffer
 */
exports.bufferAsHex = function (buff, maxLen) { // #unit: TODO test it
    var rslt = '';
    if (maxLen === undefined || maxLen == null) { maxLen = 40; }
    for (var i = 0; i < buff.length && i < maxLen; i ++) {
        var num = new Number(buff.readUInt8(i));
        rslt += num.toString(16);
        if (i < (buff.length - 1)) { rslt += ' '}
    }
    return rslt;
};


/**
 * Null function used for default values of callbacks, etc.
 *
 * @function nullFunction
 * @memberof gearmanode/common
 * @type {Function}
 * @returns {void} Nothing
 */
exports.nullFunction = function() {}; // #unit: not needed


/**
 * Can be used as a default implementation of an abstract method.
 * There's no need to define such function in JS, but I do anyway because of importance of documentation.
 *
 * @function abstractMethod
 * @memberof gearmanode/common
 * @type {Function}
 * @return {void} Nothing
 * @throws {Error} when invoked to indicate the method should be overridden
 */
exports.abstractMethod = function() { // #unit: not needed
    throw new Error('unimplemented abstract method');
};


/**
 * Get UUID based on RFC 4122, section 4.4 (Algorithms for Creating a UUID from Truly Random or Pseudo-Random Number).
 *
 * @function createUUID
 * @memberof gearmanode/common
 * @returns {string} textual UUID
 */
exports.createUUID = function () {
    // http://www.ietf.org/rfc/rfc4122.txt
    var s = [];
    var hexDigits = "0123456789abcdef";
    for (var i = 0; i < 36; i++) {
        s[i] = hexDigits.substr(Math.floor(Math.random() * 0x10), 1);
    }
    s[14] = "4";  // bits 12-15 of the time_hi_and_version field to 0010
    s[19] = hexDigits.substr((s[19] & 0x3) | 0x8, 1);  // bits 6-7 of the clock_seq_hi_and_reserved to 01
    s[8] = s[13] = s[18] = s[23] = "-";

    var uuid = s.join("");
    return uuid;
}
