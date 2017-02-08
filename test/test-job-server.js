var should     = require('should'),
    sinon      = require('sinon'),
    util       = require('util'),
    net        = require('net'),
    events     = require('events'),
    gearmanode = require('../lib/gearmanode'),
    JobServer  = require('../lib/gearmanode/job-server').JobServer,
    Job        = require('../lib/gearmanode/job').Job,
    protocol   = require('../lib/gearmanode/protocol');


describe('JobServer', function() {
    var c, js;
    beforeEach(function() {
        c = gearmanode.client();
        js = c.jobServers[0];
    });


    describe('#constructor', function() {
        it('should return unconnected instance', function() {
            js = new JobServer({ host: 'localhost', port: 4730 });
            js.should.be.an.instanceof(JobServer);
            js.connected.should.be.false;
            should.not.exist(js.socket);
            should.not.exist(js.clientOrWorker);
            js.jobsWaiting4Created.length.should.equal(0);
            js.getUid().should.equal('localhost:4730');
            js.wrongDisconnectAt.should.be.equal(0);
            js.failedConnectionCount.should.be.equal(0);
        })
        it('should return error when missing mandatory options', function() {
            js = new JobServer();
            js.should.be.an.instanceof(Error);
            js = new JobServer({ host: 'localhost' });
            js.should.be.an.instanceof(Error);
            js = new JobServer({ port: 4730 });
            js.should.be.an.instanceof(Error);
        })
    })


    describe('#connect', function() {
        it('should change inner state when connection OK', function(done) {
            js.connect(function(err) {
                js.connected.should.be.true;
                js.wrongDisconnectAt.should.be.equal(0);
                js.failedConnectionCount.should.be.equal(0);
                should.exist(js.socket);
                js.socket.should.be.an.instanceof(net.Socket);
                done();
            })
        })
        it('should return socket when connection OK', function() {
            var socket = js.connect(function() {});
            should.exist(socket);
            socket.should.be.an.instanceof(net.Socket);
        })
        it('should call success callback when connection OK', function(done) {
            js.connect(function(err) {
                should.not.exist(err);
                done();
            })
        })
        it('should emit event on client when connection OK', function(done) {
            js.clientOrWorker.emit = sinon.spy();
            js.connect(function() {
                js.clientOrWorker.emit.calledOnce.should.be.true;
                js.clientOrWorker.emit.calledWith('socketConnect').should.be.true;
                js.clientOrWorker.emit.getCall(0).args[1].should.equal(js.getUid());
                done();
            })
        })
        it('should fire error when connection fails', function(done) {
            js.port = 1;
            js.clientOrWorker.emit = sinon.spy();
            js.connect(function(err) {
                should.exist(err);
                err.should.be.an.instanceof(Error);
                err.code.should.be.equal('ECONNREFUSED');
                js.connected.should.be.false;
                js.wrongDisconnectAt.should.be.greaterThan(0);
                js.failedConnectionCount.should.be.greaterThan(0);
                should.not.exist(js.socket);
                done();
            })
        })
        it('should disconnect connection whenever error occurs', function(done) {
            js.port = 1;
            js.clientOrWorker.emit = sinon.spy(); // to blind emitting of error which terminated the test case
            js.disconnect = sinon.spy();
            js.connect(function() {
                js.disconnect.calledOnce.should.be.true;
                done();
            })
        })
        it('BF9: should connect once if two `send` invoked on unconnected server', function() {
            var w = gearmanode.worker();
            sinon.spy(w.jobServers[0], 'send'); // proxies original method
            sinon.spy(w.jobServers[0], 'connect');
            w.setWorkerId('foo');
            w.setWorkerId('bar');
            w.jobServers[0].send.calledTwice.should.be.true;
            w.jobServers[0].connect.calledOnce.should.be.true;
        })
    })


    describe('#disconnect', function() {
        it('should properly change inner state', function(done) {
            var socket = js.connect(function(err, jobServer) {
                should.not.exist(err);
                js.connected.should.be.true;
                js.socket.listeners('connect').length.should.equal(2); // one is mine, the other from some infrastructure
                js.disconnect();
                js.connected.should.be.false;
                js.wrongDisconnectAt.should.be.equal(0);
                js.failedConnectionCount.should.be.equal(0);
                should.not.exist(js.socket);
                should.exist(js.clientOrWorker);
                js.jobsWaiting4Created.length.should.equal(0);
                done();
            })
        })
        it('should set `wrongDisconnectAt` when disconnect caused by a problem', function(done) {
            var socket = js.connect(function(err, jobServer) {
                should.not.exist(err);
                js.disconnect(true); // true => simulate an error object
                js.wrongDisconnectAt.should.be.greaterThan(0);
                js.failedConnectionCount.should.be.greaterThan(0);
                done();
            })
        })
        it('should emit event on client/worker', function(done) {
            js.clientOrWorker.emit = sinon.spy();
            js.connect(function() {
                js.disconnect();
                js.clientOrWorker.emit.calledTwice.should.be.true; // connect + disconnect
                js.clientOrWorker.emit.getCall(1).args[0].should.equal('socketDisconnect');
                js.clientOrWorker.emit.getCall(1).args[1].should.equal(js.getUid());
                done();
            })
        })
    })


    describe('#echo #setOption', function() {
        it('should return error when invalid options', function() {
            js.echo().should.be.an.instanceof(Error);
            js.echo(null).should.be.an.instanceof(Error);
            js.echo(1).should.be.an.instanceof(Error);
            should.not.exist(js.echo('1'));
        })
    })


    describe('#echo', function() {
        it('should return echoed data in response', function(done) {
            js.once('echo', function(response) {
                response.should.equal('ping');
                done();
            });
            js.echo('ping');
        })
    })


    describe('#setOption', function() {
        it('should return name of the option that was set', function(done) {
            js.once('option', function(response) {
                response.should.equal('exceptions');
                done();
            });
            js.setOption('exceptions');
        })
        it('should emit server error on itself if option is unknown', function(done) {
            js.clientOrWorker.emit = sinon.spy();
            js.once('jobServerError', function(code, msg) {
                code.toUpperCase().should.equal(protocol.CONSTANTS.UNKNOWN_OPTION); // toUpperCase -> some version of gearmand returns message as lower case
                js.clientOrWorker.emit.calledTwice.should.be.true; // connect + error, emit on Job Server after emit on Client/Worker
                js.clientOrWorker.emit.getCall(1).args[0].should.equal('jobServerError');
                js.clientOrWorker.emit.getCall(1).args[1].should.equal(js.getUid());
                js.clientOrWorker.emit.getCall(1).args[2].toUpperCase().should.equal(protocol.CONSTANTS.UNKNOWN_OPTION);
                done();
            });
            js.setOption('foo');
        })
        it('should emit server error on client/worker if option is unknown', function(done) {
            sinon.spy(js, 'emit'); // proxies original method
            c.once('jobServerError', function(uid, code, msg) {
                uid.should.equal(js.getUid());
                code.toUpperCase().should.equal(protocol.CONSTANTS.UNKNOWN_OPTION);
                js.emit.callCount.should.equal(1); // internal event to signal successful connection
                done();
            });
            js.setOption('foo');
        })
    })


    describe('#send', function() {
        var hiPacket = protocol.encodePacket(protocol.PACKET_TYPES.ECHO_REQ, ['hi']);
        it('should autoconnect when not connected before', function() {
            js.connect = sinon.spy();
            js.send(hiPacket);
            js.connect.calledOnce.should.be.true;
        })
        it('should not autoconnect again when connected before', function() {
            js.connect = sinon.spy();
            js.connect(function() {
                js.connect.calledOnce.should.be.true;
                js.send(hiPacket);
                js.connect.calledOnce.should.be.true;
            })
        })
        it('should emit `socketError` on client when sending fails due to connection', function(done) {
            js.port = 1;
            js.clientOrWorker.once('socketError', function(uid, err) {
                uid.should.equal('localhost:1');
                should.exist(err);
                err.should.be.an.instanceof(Error);
                err.code.should.be.equal('ECONNREFUSED');
                done();
            });
            js.send(hiPacket);
        })
        it('should call error callback when data not a Buffer', function() {
            js.send('TEXT NOT ALLOWED').should.be.an.instanceof(Error);
        })
    })


    describe('#_processData', function() {
        it('should process NOOP message correctly', function() {
            var chunk = new Buffer([0x00, 0x52, 0x45, 0x53, 0x00, 0x00, 0x00, 0x06, 0x00, 0x00, 0x00, 0x00]); // NOOP
            js.clientOrWorker._response = sinon.spy();
            js.connected = true;
            js._processData(chunk);
            should.not.exist(js.segmentedPacket);
            js.clientOrWorker._response.calledOnce.should.be.true;
            js.clientOrWorker._response.getCall(0).args[1].should.equal(protocol.PACKET_TYPES.NOOP);
        })        
        it('should process one packet with two messages correctly', function(done) {
            var chunk1 = new Buffer([0x00, 0x52, 0x45, 0x53, 0x00, 0x00, 0x00, 0x06, 0x00, 0x00, 0x00, 0x00]); // NOOP
            var chunk2 = new Buffer([0x00, 0x52, 0x45, 0x53, 0x00, 0x00, 0x00, 0x0a, 0x00, 0x00, 0x00, 0x00]); // NO_JOB
            var chunk = Buffer.concat([chunk1, chunk2]);
            js.clientOrWorker._response = sinon.spy();
            js.connected = true;
            js._processData(chunk);
            // '_processData' works recursively in this case; the second call is via 'process.nextTick'
            // so the asserts must be in the next tick
            process.nextTick(function() {
                should.not.exist(js.segmentedPacket);
                js.clientOrWorker._response.calledTwice.should.be.true;
                js.clientOrWorker._response.getCall(0).args[1].should.equal(protocol.PACKET_TYPES.NOOP);
                js.clientOrWorker._response.getCall(1).args[1].should.equal(protocol.PACKET_TYPES.NO_JOB);
                done();
            })
        })
        it('should process more packet with one messages correctly', function() {
            var chunk1 = new Buffer([0x00, 0x52, 0x45, 0x53, 0x00, 0x00, 0x00, 0x0b, 0x00, 0x00, 0x00, 0x14]); // JOB_ASSIGN
            var chunk2 = new Buffer([0x48, 0x3a, 0x6c, 0x61, 0x70, 0x3a, 0x31, 0x00, 0x72, 0x65, 0x76, 0x65, 0x72, 0x73, 0x65, 0x00,
                                     0x74, 0x65, 0x73, 0x74]);
            js.clientOrWorker._response = sinon.spy();
            js.connected = true;
            js._processData(chunk1);
            should.exist(js.segmentedPacket);
            js.clientOrWorker._response.called.should.be.false;
            js._processData(chunk2);
            should.not.exist(js.segmentedPacket);
            js.clientOrWorker._response.calledOnce.should.be.true;
            js.clientOrWorker._response.getCall(0).args[1].should.equal(protocol.PACKET_TYPES.JOB_ASSIGN);
        })
        it('should process more packet(length less than the header length) with one messages correctly', function() {
            var chunk1 = new Buffer([0x00, 0x52, 0x45, 0x53, 0x00, 0x00, 0x00, 0x0b, 0x00, 0x00, 0x00, 0x14]); // JOB_ASSIGN
            var chunk2 = new Buffer([0x48, 0x3a, 0x6c, 0x61, 0x70, 0x3a, 0x31, 0x00, 0x72, 0x65, 0x76, 0x65, 0x72, 0x73, 0x65, 0x00]);
            var chunk3 = new Buffer([0x74, 0x65, 0x73, 0x74]);
            js.clientOrWorker._response = sinon.spy();
            js.connected = true;
            js._processData(chunk1);
            should.exist(js.segmentedPacket);
            js.clientOrWorker._response.called.should.be.false;
            js._processData(chunk2);
            should.exist(js.segmentedPacket);
            js.clientOrWorker._response.called.should.be.false;
            js._processData(chunk3);
            should.not.exist(js.segmentedPacket);
            js.clientOrWorker._response.calledOnce.should.be.true;
            js.clientOrWorker._response.getCall(0).args[1].should.equal(protocol.PACKET_TYPES.JOB_ASSIGN);
        })
        it('PR 41: should concatenate one message with header splitted into two packets', function() {
            var chunk1 = new Buffer([0x00, 0x52, 0x45]);
            var chunk2 = new Buffer([0x53, 0x00, 0x00, 0x00, 0x06, 0x00, 0x00, 0x00, 0x00, // NOOP
                                     0x00, 0x00, 0x00]); // + 3 bytes to be >= 12
            js.clientOrWorker._response = sinon.spy();
            js.connected = true;
            js._processData(chunk1);
            should.exist(js.segmentedPacket);
            js._processData(chunk2);
            process.nextTick(function() {
                should.exist(js.segmentedPacket);
                done();
            });
            js.clientOrWorker._response.calledOnce.should.be.true;
            js.clientOrWorker._response.getCall(0).args[1].should.equal(protocol.PACKET_TYPES.NOOP);
        })
    })

})
