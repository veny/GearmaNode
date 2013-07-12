var should     = require('should'),
    gearmanode = require('../lib/gearmanode'),
    Client     = gearmanode.Client,
    Job        = gearmanode.Job,
    JobServer  = require('../lib/gearmanode/job-server').JobServer;


describe('Client', function() {
    var c;
    beforeEach(function() {
        c = gearmanode.client();
    });


    describe('#factory', function() {
        it('should return default instance of Client', function() {
            c.should.be.an.instanceof(Client);
            c._type.should.equal('Client');
            should.exist(c.jobServers);
            should.exist(c.jobs);
            Object.keys(c.jobs).length.should.equal(0);
        })
        it('should return error when servers are duplicate', function() {
            var c = gearmanode.client({ servers: [{host: 'localhost'}, {host: 'localhost'}] });
            c.should.be.an.instanceof(Error);
        })
    })


    describe('#close', function() {
        it('should clean up object', function() {
            c.jobs['H:lima:207'] = new Job(c, { name: 'reverse', payload: 'hi' }); // mock the jobs
            Object.keys(c.jobs).length.should.equal(1);
            c.close();
            c.closed.should.be.true;
            Object.keys(c.jobs).length.should.equal(0);
            c.jobServers.length.should.equal(1);
        })
    })


    describe('#submit', function() {
        it('should set many managing values', function(done) {
            c.submitJob({name: 'reverse', payload: 'hi'}, function(err, job) {
                var js = c.jobServers[0];
                js.jobsWaiting4Created.length.should.equal(1);
                js.jobsWaiting4Created[0].should.equal(job);
                job.processing.should.be.true;
                job.jobServerUid.should.equal(js.getUid());
                done();
            })
        })
        it('should call success callback if submiting OK', function(done) {
            c.submitJob({name: 'reverse', payload: 'hi'}, function(err, job) {
                should.not.exist(err);
                should.exist(job);
                job.should.be.an.instanceof(Job);
                done();
            })
        })
        it('should call error callback if submiting fails', function(done) {
            var c = gearmanode.client({port: 1});
            c.submitJob({name: 'reverse', payload: 'hi'}, function(err, job) {
                should.exist(err);
                err.should.be.an.instanceof(Error);
                should.exist(job);
                job.should.be.an.instanceof(Job);
                done();
            })
        })
    })

})
