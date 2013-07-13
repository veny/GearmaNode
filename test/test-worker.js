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
            w.functions.reverse[0].should.be.an.instanceof(Function);
            w._sendWithJobServer.calledOnce.should.be.true;
            w._preSleep.calledOnce.should.be.true;
        })
    //     it('should call success callback if submiting OK', function(done) {
    //         c.submitJob({name: 'reverse', payload: 'hi'}, function(err, job) {
    //             should.not.exist(err);
    //             should.exist(job);
    //             job.should.be.an.instanceof(Job);
    //             done();
    //         })
    //     })
    //     it('should call error callback if submiting fails', function(done) {
    //         var c = gearmanode.client({port: 1});
    //         c.submitJob({name: 'reverse', payload: 'hi'}, function(err, job) {
    //             should.exist(err);
    //             err.should.be.an.instanceof(Error);
    //             should.exist(job);
    //             job.should.be.an.instanceof(Job);
    //             done();
    //         })
    //     })
    })

})
