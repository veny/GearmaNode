var should    = require('should'),
    sinon     = require('sinon'),
    util      = require('util'),
    net       = require('net'),
    JobServer = require('../lib/gearmanode/job-server').JobServer,
    Job       = require('../lib/gearmanode/job').Job,
    protocol  = require('../lib/gearmanode/protocol');


var defaultJobServerWithMockedClient = function () {
    var js = new JobServer({ host: 'localhost', port: 4730 });
    js.client = { jobs: [], emit: sinon.spy() };
    return js;
}


describe('JobServer', function() {


    describe('#constructor', function() {
        it('should return unconnected instance', function() {
            var js = new JobServer({ host: 'localhost', port: 4730 });
            js.should.be.an.instanceof(JobServer);
            js.connected.should.be.false;
            should.not.exist(js.socket);
            js.jobsWaiting4Created.length.should.equal(0);
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
        it('should change inner state when connection OK', function(done) {
            var js = defaultJobServerWithMockedClient();
            js.connect(function(err) {
                js.connected.should.be.true;
                should.exist(js.socket);
                js.socket.should.be.an.instanceof(net.Socket);
                done();
            })
        })
        it('should return socket when connection OK', function() {
            var js = defaultJobServerWithMockedClient();
            var socket = js.connect(function() {});
            should.exist(socket);
            socket.should.be.an.instanceof(net.Socket);
        })
        it('should call success callback when connection OK', function(done) {
            var js = defaultJobServerWithMockedClient();
            js.connect(function(err) {
                should.not.exist(err);
                done();
            })
        })
        it('should emit event on client when connection OK', function(done) {
            var js = defaultJobServerWithMockedClient();
            js.connect(function() {
                js.client.emit.called.should.be.true;
                js.client.emit.calledWith('js_connect').should.be.true;
                done();
            })
        })
        it('should fire error when connection fails', function(done) {
            var js = new JobServer({ host: 'localhost', port: 1 });
            var socket = js.connect(function(err) {
                should.exist(err);
                err.should.be.an.instanceof(Error);
                err.code.should.be.equal('ECONNREFUSED');
                js.connected.should.be.false;
                should.not.exist(js.socket);
                done();
            })
        })
    })


    describe('#disconnect', function() {
        it('should properly change inner state', function(done) {
            var js = defaultJobServerWithMockedClient();
            var socket = js.connect(function(err, jobServer) {
                should.not.exist(err);
                js.connected.should.be.true;
                js.disconnect();
                js.connected.should.be.false;
                should.not.exist(js.socket);
                js.jobsWaiting4Created.length.should.equal(0);
                done();
            })
        })
        it('should emit event on client', function(done) {
            var js = defaultJobServerWithMockedClient();
            js.connect(function() {
                var clientBackup = js.client;
                js.disconnect();
                clientBackup.emit.called.should.be.true;
                clientBackup.emit.calledWith('js_disconnect').should.be.true;
                done();
            })
        })
    })


    describe('#send', function() {
        var hiPacket = protocol.encodePacket(protocol.PACKET_TYPES.ECHO_REQ, 'ascii', ['hi']);
        it('should autoconnect when not connected before', function(done) {
            var js = defaultJobServerWithMockedClient();
            js.connect = sinon.spy(js, 'connect');
            js.send(hiPacket, 'ascii', function(err) {
                should.not.exist(err);
                js.connect.calledOnce.should.be.true;
                js.connected.should.be.true;
                js.client.emit.called.should.be.true;
                done();
            })
        })
        it('should not autoconnect when connected before', function(done) {
            var js = defaultJobServerWithMockedClient();
            js.connect = sinon.spy(js, 'connect');
            js.connect(function() {
                js.connect.callCount.should.be.equal(1);
                js.send(hiPacket, 'ascii', function() {
                    js.connect.callCount.should.be.equal(1);
                    done();
                })
            })
        })
        it('should call success callback when sending OK', function(done) {
            var js = defaultJobServerWithMockedClient();
            js.send(hiPacket, 'ascii', function(err) {
                should.not.exist(err);
                done();
            })
        })
        it('should call error callback when sending fails', function(done) {
            var js = new JobServer({ host: 'localhost', port: 1 });
            js.send(hiPacket, 'ascii', function(err) {
                should.exist(err);
                err.should.be.an.instanceof(Error);
                err.code.should.be.equal('ECONNREFUSED');
                done();
            })
        })
        it('should call error callback when invalid paramaters', function() {
            var js = defaultJobServerWithMockedClient();
            js.send('TEXT NOT ALLOWED', 'ascii', function(err) {
                should.exist(err);
                err.should.be.an.instanceof(Error);
            })
        })
    })


    // describe('#submit', function() {
    //     var js = new JobServer({ host: 'localhost', port: 4730 });
    //     it('should fail when not connected before', function(done) {
    //         js.submit(new Job({ name: 'reverse', payload: 'hi'}), function(err) {
    //             js.connected.should.be.false;
    //             should.exist(err);
    //             err.should.be.an.instanceof(Error);
    //             done();
    //         })
    //     })
    //     it('should set many managing values', function(done) {
    //         js.connect(function () {
    //             var j = new Job({ name: 'reverse', payload: 'hi'});
    //             js.jobsWaiting4Created.length.should.equal(0);
    //             j.processing.should.be.false;
    //             js.client = { jobs: [], emit: function() {} }; // mock the real Client object with an object literal
    //             js.submit(j, function(err) {
    //                 js.jobsWaiting4Created.length.should.equal(1);
    //                 js.jobsWaiting4Created[0].should.equal(j);
    //                 j.processing.should.be.true;
    //                 j.jobServerUid.should.equal(js.getUid());
    //                 done();
    //             })
    //         })
    //     })
    //     it('should call success callback if submiting OK', function(done) {
    //         js.connect(function () {
    //             var j = new Job({ name: 'reverse', payload: 'hi'});
    //             js.client = { jobs: [], emit: function() {} }; // mock the real Client object with an object literal
    //             js.submit(j, function(err) {
    //                 should.not.exist(err);
    //                 done();
    //             })
    //         })
    //     })
    // })

})