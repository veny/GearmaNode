var should    = require('should'),
    JobServer = require('../lib/gearmanode/job-server').JobServer,
    Job       = require('../lib/gearmanode/job').Job;


describe('JobServer', function() {


    describe('#constructor', function() {
        it('should return unconnected instance', function() {
            var js = new JobServer({ host: 'localhost', port: 4730 });
            js.should.be.an.instanceof(JobServer);
            js.connected.should.be.false;
            should.not.exist(js.socket);
            js.jobsWaiting4Created.length.should.equal(0);
            Object.keys(js.jobsWaiting4Complete).length.should.equal(0);
            js.getUid().should.equal('localhost:4730');
        })
        it('should return error when missing mandatory options', function() {
            var js = new JobServer();
            js.should.be.an.instanceof(Error);
            js = new JobServer({ host: 'localhost' });
            js.should.be.an.instanceof(Error);
            js = new JobServer({ port: 4730 });
            js.should.be.an.instanceof(Error);
        })
    })


    describe('#connect', function() {
        it('should return socket when connection OK', function(done) {
            var js = new JobServer({ host: 'localhost', port: 4730 });
            var socket = js.connect(function(err) {
                should.not.exist(err);
                js.connected.should.be.true;
                should.exist(js.socket);
                js.socket.listeners.length.should.equal(1);
                done();
            })
        })
        it('should fire error when connection fails', function(done) {
            var js = new JobServer({ host: 'localhost', port: 1 });
            var socket = js.connect(function(err) {
                err.should.be.an.instanceof(Error);
                js.connected.should.be.false;
                should.not.exist(js.socket);
                done();
            })
        })
    })


    describe('#disconnect', function() {
        it('should properly release all resources', function(done) {
            var js = new JobServer({ host: 'localhost', port: 4730 });
            var socket = js.connect(function(err, jobServer) {
                should.not.exist(err);
                js.connected.should.be.true;
                js.disconnect();
                js.connected.should.be.false;
                should.not.exist(js.socket);
                js.jobsWaiting4Created.length.should.equal(0);
                Object.keys(js.jobsWaiting4Complete).length.should.equal(0);
                done();
            })
        })
    })


    describe('#submit', function() {
        var js = new JobServer({ host: 'localhost', port: 4730 });
        it('should fail when not connected before', function(done) {
            js.submit(new Job({ name: 'reverse', payload: 'hi'}), function(err) {
                js.connected.should.be.false;
                should.exist(err);
                err.should.be.an.instanceof(Error);
                done();
            })
        })
        it('should set many managing values', function(done) {
            js.connect(function () {
                var j = new Job({ name: 'reverse', payload: 'hi'});
                js.jobsWaiting4Created.length.should.equal(0);
                j.processing.should.be.false;
                js.submit(j, function(err) {
                    js.jobsWaiting4Created.length.should.equal(1);
                    js.jobsWaiting4Created[0].should.equal(j);
                    j.processing.should.be.true;
                    j.jobServerUid.should.equal(js.getUid());
                    done();
                })
            })
        })
        it('should call success callback if submiting OK', function(done) {
            js.connect(function () {
                var j = new Job({ name: 'reverse', payload: 'hi'});
                js.submit(j, function(err) {
                    should.not.exist(err);
                    done();
                })
            })
        })

    })
})