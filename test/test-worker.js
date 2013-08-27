var should     = require('should'),
    sinon      = require('sinon'),
    gearmanode = require('../lib/gearmanode'),
    Worker     = gearmanode.Worker,
    Job        = gearmanode.Job,
    JobServer  = require('../lib/gearmanode/job-server').JobServer;


describe('Worker', function() {
    var w;
    beforeEach(function() {
        w = gearmanode.worker();
        w._sendWithJobServer = sinon.spy();
        w._preSleep = sinon.spy();
    });


    describe('#factory', function() {
        it('should return default instance of Worker', function() {
            w.should.be.an.instanceof(Worker);
            w._type.should.equal('Worker');
            should.exist(w.jobServers);
            should.exist(w.functions);
            Object.keys(w.functions).length.should.equal(0);
        })
    })


    describe('#close', function() {
        it('should clean up object', function() {
            w.functions['reverse'] = [function() {}, {}]; // mock the functions
            Object.keys(w.functions).length.should.equal(1);
            w.close();
            w.closed.should.be.true;
            Object.keys(w.functions).length.should.equal(0);
        })
    })


    describe('#addFuntion', function() {
        it('should set many managing values', function() {
            w.addFuntion('reverse', function() {});
            Object.keys(w.functions).length.should.equal(1);
            should.exist(w.functions.reverse);
            w.functions.reverse.should.be.an.instanceof(Array);
            w.functions.reverse.length.should.equal(2);
            w.functions.reverse[0].should.be.an.instanceof(Function);
            Object.keys(w.functions.reverse[1]).length.should.equal(0); // empty options: {}
            w._sendWithJobServer.calledOnce.should.be.true;
            w._preSleep.calledOnce.should.be.true;
        })
        it('should store additional options', function() {
            w.addFuntion('reverse', function() {}, {timeout: 10, withUnique: true, toStringEncoding: 'ascii'});
            Object.keys(w.functions.reverse[1]).length.should.equal(3);
            w.functions.reverse[1].timeout.should.equal(10);
            w.functions.reverse[1].withUnique.should.be.true;
            w.functions.reverse[1].toStringEncoding.should.equal('ascii');
        })
        it('should return error when invalid function name', function() {
            w.addFuntion(undefined, function() {}).should.be.an.instanceof(Error);
            w.addFuntion(null, function() {}).should.be.an.instanceof(Error);
            w.addFuntion('', function() {}).should.be.an.instanceof(Error);
        })
        it('should return error when invalid options', function() {
            w.addFuntion('foo', function() {}, {foo: true}).should.be.an.instanceof(Error);
            w.addFuntion('foo', function() {}, {toStringEncoding: 'InVaLiD'}).should.be.an.instanceof(Error);
        })
        it('should return error when no callback given', function() {
            w.addFuntion('reverse').should.be.an.instanceof(Error);
        })
    })


    describe('#removeFuntion', function() {
        it('should set many managing values', function() {
            w.addFuntion('reverse', function() {});
            w.removeFuntion('reverse');
            Object.keys(w.functions).length.should.equal(0);
            should.not.exist(w.functions.reverse);
            w._sendWithJobServer.calledTwice.should.be.true; // addRunction + removeFunction
        })
        it('should return error when function name not known', function() {
            w.addFuntion('foo', function() {});
            w.removeFuntion('bar').should.be.an.instanceof(Error);
        })
        it('should return error when invalid function name', function() {
            w.removeFuntion(undefined).should.be.an.instanceof(Error);
            w.removeFuntion(null).should.be.an.instanceof(Error);
            w.removeFuntion('').should.be.an.instanceof(Error);
        })
    })

})
