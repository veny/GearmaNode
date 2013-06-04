var should      = require('should'),
    JobServer   = require('../lib/gearmanode/job-server').JobServer;


describe('JobServer', function() {

    describe('#constructor', function() {
        it('should return unconnected instance', function() {
            var js = new JobServer({ host: 'localhost', port: 4730 });
            js.should.be.an.instanceof(JobServer);
            js.connected.should.be.false;
        })
        it('should return error when incorrect options', function() {
            var js = new JobServer({ host: 'localhost' });
            js.should.be.an.instanceof(Error);
        })
    })

    describe('#connect', function() {
        it('should return socket when connection OK', function() {
            var js = new JobServer({ host: 'localhost', port: 4730 });
            js.connected.should.be.false;
            var socket = js.connect(function(arg) {
                arg.should.be.an.instanceof(JobServer);
                arg.should.equal(js);
                arg.connected.should.be.true;
            });
            should.exist(socket);
            should.exist(js.socket);
            socket.should.equal(js.socket);
        })
        it('should fire error when connection fails', function() {
            var js = new JobServer({ host: 'localhost', port: 1 });
            js.connected.should.be.false;
            var socket = js.connect(function(arg) {
                arg.should.be.an.instanceof(Error);
                js.connected.should.be.false;
                should.not.exist(js.socket);
            });
            js.connected.should.be.false;
        })
    })

})