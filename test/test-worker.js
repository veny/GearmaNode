var should     = require('should'),
    gearmanode = require('../lib/gearmanode'),
    Worker     = gearmanode.Worker,
    Job        = gearmanode.Job,
    JobServer  = require('../lib/gearmanode/job-server').JobServer;


describe('Worker', function() {
    var w;
    beforeEach(function() {
        w = gearmanode.worker();
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


    // describe('#submit', function() {
    //     it('should set many managing values', function(done) {
    //         c.submitJob({name: 'reverse', payload: 'hi'}, function(err, job) {
    //             var js = c.jobServers[0];
    //             js.jobsWaiting4Created.length.should.equal(1);
    //             js.jobsWaiting4Created[0].should.equal(job);
    //             job.processing.should.be.true;
    //             job.jobServerUid.should.equal(js.getUid());
    //             done();
    //         })
    //     })
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
    // })

})
