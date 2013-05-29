/*
 * This script represents a set of utilities, helpers and convenience functions for internal use.
 *
 * (C) 2013 Vaclav Sykora
 * Apache License, Version 2.0, http://www.apache.org/licenses/
 *
 */


 /**
  * Verifies given options against a pattern that defines checks applied on each option.
  * The pattern is an object where property is an expected option's property and value can be:
  *  * 'optional'  - corresponding option may or may not be presented
  *  * 'mandatory' - corresponding option has to be presented
  *  * Array       - corresponding option has to be presented and value has to be in the given list
  * Usage:
  * IW.utils.verify_options(optionsToBeVerified,
  *    {foo: 'mandatory', bar: [true, false], baz: 'optional'});
  */
exports.verifyOptions = function (options, pattern) {
    if (options === 'undefined') {
        throw "options not presented";
    }
    if (pattern === 'undefined') {
        throw "pattern not presented";
    }

    // unknown key?
    var key;
    for (key in options) {
        if (options.hasOwnProperty(key)) {
            if (!pattern.hasOwnProperty(key)) {
                throw "unknow option: " + key;
            }

            // option in a set of allowed values
            if (IW.$.isArray(pattern[key]) && IW.$.inArray(options[key], pattern[key]) == -1) {
                throw "value '" + options[key] + "' not in defined range, key=" + key;
            }
        }
    }

    // missing mandatory option?
    for (key in pattern) {
        if (pattern.hasOwnProperty(key)) {
            if ((pattern[key] === 'mandatory' || IW.$.isArray(pattern[key])) && !options.hasOwnProperty(key)) {
                throw "missing mandatory option: " + key;
            }
        }
    }
};


/**
 * The same as <code>verifyOptions< /code> with opportunity to define default values
 * of paramaters that will be set if missing in options.
 * Usage:
 * IW.utils.verify_options(optionsToBeVerified,
 *    {foo: 'defaultValue', bar: 100});
 */
exports.verifyAndSanitizeOptions = function (options, pattern) {
    this.verifyOptions(options, pattern);

    // set default values if missing in options
    var key;
    for (key in pattern) {
        if (pattern.hasOwnProperty(key)) {
            if (pattern[key] && pattern[key] !== 'optional'
                    && pattern[key] !== 'mandatory' && options[key] === undefined) {
                options[key] = pattern[key];
            }

            //create missing optional attribute (it useful in templa
            if (pattern[key] === 'optional' && !options.hasOwnProperty(key)) {
                options[key] = null;
            }
        }
    }
};
