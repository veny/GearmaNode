
var should = require('should'),
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

            it('should return true when options are OK', function() {
                rslt.should.be.a('boolean');
                rslt.should.be.true;
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
            common.verifyAndSanitizeOptions({ alpha: true, charly: true, invalid: 1 }, pattern).should.be.an.instanceof(Error);
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
            opts.alpha.should.equal(true);
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
            opts.charly.should.equal(true);
        })
    })

})