var should      = require('should'),
    JobServer   = require('../lib/gearmanode/job-server').JobServer;


describe('JobServer', function() {

    describe('#constructor', function() {
        it('should return unconnected instance', function() {
            var js = new JobServer({ host: 'localhost', port: 4730 });
            js.should.be.an.instanceof(JobServer);
            js.connected.should.be.false;
            should.not.exist(js.socket);
        })
        it('should return error when missing mandatory options', function() {
            var js = new JobServer({ host: 'localhost' });
            js.should.be.an.instanceof(Error);
            js = new JobServer({ port: 4730 });
            js.should.be.an.instanceof(Error);
        })
    })

    describe('#connect', function() {
        it('should return socket when connection OK', function(done) {
            var js = new JobServer({ host: 'localhost', port: 4730 });
            var socket = js.connect(function(err, jobServer) {
                should.not.exist(err);
                jobServer.should.be.an.instanceof(JobServer);
                jobServer.should.equal(js);
                jobServer.connected.should.be.true;
                should.exist(js.socket);
                done();
            });
        })
        it('should fire error when connection fails', function(done) {
            var js = new JobServer({ host: 'localhost', port: 1 });
            var socket = js.connect(function(err) {
                err.should.be.an.instanceof(Error);
                js.connected.should.be.false;
                should.not.exist(js.socket);
                done();
            });
        })
    })

})