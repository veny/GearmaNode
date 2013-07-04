/*
 * This script represents a set of utilities, helpers and convenience functions for internal use.
 *
 * (C) 2013 Vaclav Sykora
 * Apache License, Version 2.0, http://www.apache.org/licenses/
 *
 */


var util = require('util');


 /**
  * Verifies given options against a pattern that defines checks applied on each option.
  * The pattern is an object where property is an expected option's property and value can be:
  *  * 'optional'  - corresponding option may or may not be presented
  *  * 'mandatory' - corresponding option has to be presented
  *  * Array       - corresponding option has to be presented and value has to be in the given list
  * Usage:
  * verifyOptions(optionsToBeVerified, {foo: 'mandatory', bar: [true, false], baz: 'optional'});
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
 * Special values are:
 *  * 'null' which is considered as a desired value and will be NOT modified
 *  * 'undefined' which is considered as a missing value and will be modified
 * Usage:
 * verifyAndSanitizeOptions(optionsToBeVerified, {foo: 'defaultValue', bar: 100});
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
 * Mixes in properties from source to destination
 * and so allows objects to borrow (or inherit) functionality from them with a minimal amount of complexity.
 */
exports.mixin = function (source, destination) {
  for (var k in source) {
    if (source.hasOwnProperty(k)) {
      destination[k] = source[k];
    }
  }
  return destination;
}


/**
 * Converts given buffer to space separated string of hexadecimal values of byte array.
 */
exports.bufferAsHex = function (buff) { // #unit: TODO test it
    var rslt = '';
    for (var i = 0; i < buff.length; i ++) {
        var num = new Number(buff.readUInt8(i));
        rslt += num.toString(16);
        if (i < (buff.length - 1)) { rslt += ' '}
    }
    return rslt;
};

