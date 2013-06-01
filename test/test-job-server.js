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
        var js = new JobServer({ host: 'localhost', port: 4730 });

        it('should return instance of Socket', function() {
            var socket = js.connect(function(e) {console.log('QQ ' + e)});
            //should.exist(socket);
        })
    })

})