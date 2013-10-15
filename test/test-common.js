
var should = require('should'),
    util   = require('util'),
    common = require('../lib/gearmanode/common');

describe('common', function() {

    describe('#verifyOptions()', function() {
        var pattern = { foo: 'mandatory', baz: 'optional', bar: [1, 2, 3] };

        it('should return error when options not presented', function() {
            var undf;
            common.verifyOptions(undf, pattern).should.be.an.instanceof(Error);
            common.verifyOptions(null, pattern).should.be.an.instanceof(Error);
        })
        it('should return error when pattern not presented', function() {
            var undf;
            common.verifyOptions({}, undf).should.be.an.instanceof(Error);
            common.verifyOptions({}, null).should.be.an.instanceof(Error);
        })

        it('should return error when an unknown option found', function() {
            common.verifyOptions({ pipapo: 1 }, pattern).should.be.an.instanceof(Error);
        })
        it('should return error when an option not in set of allowed values', function() {
            common.verifyOptions({ foo: true, bar: 11111 }, pattern).should.be.an.instanceof(Error);
            common.verifyOptions({ foo: true, bar: null }, pattern).should.be.an.instanceof(Error);
            common.verifyOptions({ foo: true, bar: undefined }, pattern).should.be.an.instanceof(Error);
        })

        it('should return error when missing a mandatory option/Array', function() {
            common.verifyOptions({ bar: 1 }, pattern).should.be.an.instanceof(Error);
            common.verifyOptions({ foo: true }, pattern).should.be.an.instanceof(Error);
            common.verifyOptions({ foo: null, bar: 1 }, pattern).should.be.an.instanceof(Error);
            common.verifyOptions({ foo: undefined, bar: 1 }, pattern).should.be.an.instanceof(Error);
        })

        describe('OK', function() {
            var opts = { foo: true, baz: 'here', bar: 1 };
            var rslt = common.verifyOptions(opts, pattern);

            it('should return the options when all validations OK', function() {
                rslt.should.equal(opts);
            })
            it('should not modify options', function() {
                Object.keys(opts).length.should.equal(3);
                opts.foo.should.equal(true);
                opts.baz.should.equal('here');
                opts.bar.should.equal(1);
            })
        })

    })

    describe('#verifyAndSanitizeOptions()', function() {
        var pattern = { alpha: 'bravo', charly: 'delta' };

        it('should behave like #verifyOptions in validation', function() {
            common.verifyAndSanitizeOptions({ alpha: true, charly: true, pipapo: 1 }, pattern).should.be.an.instanceof(Error);
        })
        it('should not modify options when all provided', function() {
            var opts = { alpha: true, charly: false };
            var rslt = common.verifyAndSanitizeOptions(opts, pattern);
            Object.keys(opts).length.should.equal(2);
            opts.alpha.should.equal(true);
            opts.charly.should.equal(false);
        })
        it('should not modify options when value is null', function() {
            var opts = { alpha: null };
            var rslt = common.verifyAndSanitizeOptions(opts, pattern);
            Object.keys(opts).length.should.equal(2);
            should.strictEqual(opts.alpha, null);
            opts.charly.should.equal('delta');
        })
        it('should modify options when not provided', function() {
            var opts = { charly: false };
            var rslt = common.verifyAndSanitizeOptions(opts, pattern);
            opts.alpha.should.equal('bravo');
            opts.charly.should.equal(false);
            // --
            opts = { alpha: true };
            rslt = common.verifyAndSanitizeOptions(opts, pattern);
            opts.alpha.should.be.true;
            opts.charly.should.equal('delta');
            // --
            opts = {};
            rslt = common.verifyAndSanitizeOptions(opts, pattern);
            Object.keys(opts).length.should.equal(2);
            opts.alpha.should.equal('bravo');
            opts.charly.should.equal('delta');
        })
        it('should modify options when value is undefined', function() {
            var opts = { alpha: undefined, charly: true };
            var rslt = common.verifyAndSanitizeOptions(opts, pattern);
            Object.keys(opts).length.should.equal(2);
            should.strictEqual(opts.alpha, 'bravo');
            opts.charly.should.be.true;
        })
 
        // BF -----------------------------------

        it('should modify options when default value is boolean', function() {
            var opts = {};
            var rslt = common.verifyAndSanitizeOptions(opts, { foo: true, bar: false });
            Object.keys(opts).length.should.equal(2);
            opts.foo.should.be.true;
            opts.bar.should.be.false;
        })
    })


    describe('#isString()', function() {
        it('should identify given object as a String', function() {
            common.isString('string literal').should.be.true;
            common.isString('    ').should.be.true;
            common.isString('').should.be.true;
            common.isString(new String('String object')).should.be.true;
            common.isString(1).should.be.false; // number literal
            common.isString(true).should.be.false; // boolean literal
            common.isString({}).should.be.false; // object
            common.isString(null).should.be.false;
            common.isString(undefined).should.be.false;
        })
    })


    describe('#isNumber()', function() {
        it('should identify given object as a Number', function() {
            common.isNumber(5).should.be.true;
            common.isNumber(new Number(5)).should.be.true;
            common.isNumber('').should.be.false;
            common.isNumber('123').should.be.false; // string literal
            common.isNumber(true).should.be.false; // boolean literal
            common.isNumber({}).should.be.false; // object
            common.isNumber(null).should.be.false;
            common.isNumber(undefined).should.be.false;
        })
    })


    describe('#clone()', function() {
        it('should clone a simple object', function() {
            var from = {alpha: 'bravo', charly: 'delta'};
            var cloned = common.clone(from);
            from.should.not.equal(cloned);
            Object.keys(cloned).length.should.equal(2);
            cloned.alpha.should.equal('bravo');
            cloned.charly.should.equal('delta');
            from.foo = 'bar';
            from.foo.should.equal('bar');
            should.not.exist(cloned.foo);
        })
        it('should clone an Array', function() {
            var from = ['first', 'second'];
            var cloned = common.clone(from);
            cloned.should.be.an.instanceof(Array);
            from.should.not.equal(cloned);
            cloned.length.should.equal(2);
            cloned[0].should.equal('first');
            cloned[1].should.equal('second');
            from.push('third');
            from.length.should.equal(3);
            cloned.length.should.equal(2);
        })
    })

})