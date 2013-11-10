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
                js.clientOrWorker.emit.calledWith('js_connect').should.be.true;
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
    })


    describe('#disconnect', function() {
        it('should properly change inner state', function(done) {
            var socket = js.connect(function(err, jobServer) {
                should.not.exist(err);
                js.connected.should.be.true;
                js.disconnect();
                js.connected.should.be.false;
                should.not.exist(js.socket);
                should.exist(js.clientOrWorker);
                js.jobsWaiting4Created.length.should.equal(0);
                done();
            })
        })
        it('should emit event on client/worker', function(done) {
            js.clientOrWorker.emit = sinon.spy();
            js.connect(function() {
                js.disconnect();
                js.clientOrWorker.emit.calledTwice.should.be.true; // connect + disconnect
                js.clientOrWorker.emit.getCall(1).args[0].should.equal('disconnect');
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
                code.should.equal(protocol.CONSTANTS.UNKNOWN_OPTION);
                js.clientOrWorker.emit.calledTwice.should.be.true; // connect + error, emit on Job Server after emit on Client/Worker
                js.clientOrWorker.emit.getCall(1).args[0].should.equal('jobServerError');
                js.clientOrWorker.emit.getCall(1).args[1].should.equal(js.getUid());
                js.clientOrWorker.emit.getCall(1).args[2].should.equal(protocol.CONSTANTS.UNKNOWN_OPTION);
                done();
            });
            js.setOption('foo');
        })
        it('should emit server error on client/worker if option is unknown', function(done) {
            js.emit = sinon.spy();
            c.once('jobServerError', function(uid, code, msg) {
                uid.should.equal(js.getUid());
                code.should.equal(protocol.CONSTANTS.UNKNOWN_OPTION);
                js.emit.callCount.should.equal(0); // emit on Job Server after emit on Client/Worker
                done();
            });
            js.setOption('foo');
        })
    })


    describe('#send', function() {
        var hiPacket = protocol.encodePacket(protocol.PACKET_TYPES.ECHO_REQ, 'ascii', ['hi']);
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
        it('should emit `js_econnrefused` on client when sending fails due to connection', function(done) {
            js.port = 1;
            js.clientOrWorker.once('js_econnrefused', function(err) {
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

})
