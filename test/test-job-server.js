var should    = require('should'),
    sinon     = require('sinon'),
    util      = require('util'),
    net       = require('net'),
    events    = require('events'),
    JobServer = require('../lib/gearmanode/job-server').JobServer,
    Job       = require('../lib/gearmanode/job').Job,
    protocol  = require('../lib/gearmanode/protocol');


describe('JobServer', function() {
    var js;
    beforeEach(function() {
        js = new JobServer({ host: 'localhost', port: 4730 });
        var emitter = new events.EventEmitter();
        js.clientOrWorker = { jobs: [], emit: sinon.spy() };
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
            js.connect(function() {
                js.clientOrWorker.emit.calledOnce.should.be.true;
                js.clientOrWorker.emit.calledWith('js_connect').should.be.true;
                js.clientOrWorker.emit.getCall(0).args[1].should.equal(js.getUid());
                done();
            })
        })
        it('should fire error when connection fails', function(done) {
            js = new JobServer({ host: 'localhost', port: 1 });
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
        it('should emit event on client', function(done) {
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
        it('should store callback for response', function() {
            js.echo('ping', function() {});
            should.exist(js.expectedJsResponseCallback);
        })
        it('should return error when invalid options', function() {
            js.echo().should.be.an.instanceof(Error);
            js.echo('1').should.be.an.instanceof(Error);
            js.echo(1).should.be.an.instanceof(Error);
            js.echo(1, function() {}).should.be.an.instanceof(Error);
            js.echo('1', '1').should.be.an.instanceof(Error);
            should.not.exist(js.echo('1', function() {}));
        })
    })


    describe('#echo', function() {
        it('should return echoed data in response', function(done) {
            js.echo('ping', function(err, response) {
                should.not.exist(js.expectedJsResponseCallback);
                should.not.exist(err);
                response.should.equal('ping');
                done();
            });
        })
    })


    describe('#setOption', function() {
        it('should return name of the option that was set', function(done) {
            js.setOption('exceptions', function(err, response) {
                should.not.exist(js.expectedJsResponseCallback);
                should.not.exist(err);
                response.should.equal('exceptions');
                done();
            });
        })
        it('should reply with error if option is unknown', function(done) {
            js.setOption('foo', function(err, response) {
                should.not.exist(js.expectedJsResponseCallback);
                should.not.exist(response);
                err.should.be.an.instanceof(Error);
                done();
            });
        })
    })


    describe('#send', function() {
        var hiPacket = protocol.encodePacket(protocol.PACKET_TYPES.ECHO_REQ, 'ascii', ['hi']);
        it('should autoconnect when not connected before', function() {
            js.connect = sinon.spy();
            js.send(hiPacket);
            js.connect.calledOnce.should.be.true;
        })
        it('should autoconnect when connected before', function() {
            js.connect = sinon.spy();
            js.connect(function() {
                js.connect.calledOnce.should.be.true;
                js.send(hiPacket);
                js.connect.calledOnce.should.be.true;
            })
        })
        it('should emit error on client/error when sending fails', function(done) {
            js.port = 1;
            js.send(hiPacket);
            js.clientOrWorker.emit = function(event, err) {
                event.should.equal('error')
                err.should.be.an.instanceof(Error);
                err.code.should.be.equal('ECONNREFUSED');
                done();
            };
        })
        it('should call error callback when data not a Buffer', function() {
            js.send('TEXT NOT ALLOWED', 'ascii', function(err) {
                should.exist(err);
                err.should.be.an.instanceof(Error);
            })
        })
    })

})
