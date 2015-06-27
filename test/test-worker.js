var should     = require('should'),
    sinon      = require('sinon'),
    events     = require('events'),
    gearmanode = require('../lib/gearmanode'),
    protocol   = require('../lib/gearmanode/protocol'),
    Worker     = gearmanode.Worker,
    Job        = gearmanode.Job,
    JobServer  = require('../lib/gearmanode/job-server').JobServer;


describe('Worker', function() {
    var w, j;
    beforeEach(function() {
        w = gearmanode.worker();
        w.emit = sinon.spy();
        w.jobServers[0].send = sinon.spy();
        w._preSleep = sinon.spy();
        j = new Job(w, {handle: 'HANDLE', name: 'NAME', payload: 'PAYLOAD', jobServerUid: 'UID'});
        j.jobServerUid = w.jobServers[0].getUid();
    });


    describe('#factory', function() {
        it('should return default instance of Worker', function() {
            w.should.be.an.instanceof(Worker);
            w.withUnique.should.be.false;
            w.recoverTime.should.equal(30000);
            w.recoverLimit.should.equal(3);
            w._type.should.equal('Worker');
            should.exist(w.jobServers);
            should.exist(w.functions);
            Object.keys(w.functions).length.should.equal(0);
        })
        it('should store additional options', function() {
            w = gearmanode.worker({ withUnique: true, recoverTime: 1, recoverLimit: 1 });
            w.withUnique.should.be.true;
            w.recoverTime.should.equal(1);
            w.recoverLimit.should.equal(1);
        })
    })


    describe('#close', function() {
        it('should clean up object', function() {
            w.functions['reverse'] = [function() {}, {}]; // mock the functions
            Object.keys(w.functions).length.should.equal(1);
            w.on('error', function() {});
            events.EventEmitter.listenerCount(w, 'error').should.equal(1);
            w.close();
            w.closed.should.be.true;
            Object.keys(w.functions).length.should.equal(0);
            events.EventEmitter.listenerCount(w, 'error').should.equal(0);
        })
        it('should emit event on itself', function() {
            w.close();
            w.emit.calledTwice.should.be.true; // diconnect + close
            w.emit.getCall(0).args[0].should.equal('socketDisconnect');
            w.emit.getCall(1).args[0].should.equal('close');
        })
    })


    describe('#addFunction', function() {
        it('should set many managing values', function() {
            w.addFunction('reverse', function() {});
            Object.keys(w.functions).length.should.equal(1);
            should.exist(w.functions.reverse);
            w.functions.reverse.should.be.an.instanceof(Array);
            w.functions.reverse.length.should.equal(2);
            w.functions.reverse[0].should.be.an.instanceof(Function);
            Object.keys(w.functions.reverse[1]).length.should.equal(0); // empty options: {}
            w.jobServers[0].send.calledOnce.should.be.true;
            w._preSleep.calledOnce.should.be.true;
        })
        it('should store additional options', function() {
            w.addFunction('reverse', function() {}, {timeout: 10, toStringEncoding: 'ascii'});
            Object.keys(w.functions.reverse[1]).length.should.equal(2);
            w.functions.reverse[1].timeout.should.equal(10);
            w.functions.reverse[1].toStringEncoding.should.equal('ascii');
        })
        it('should return error when invalid function name', function() {
            w.addFunction(undefined, function() {}).should.be.an.instanceof(Error);
            w.addFunction(null, function() {}).should.be.an.instanceof(Error);
            w.addFunction('', function() {}).should.be.an.instanceof(Error);
        })
        it('should return error when invalid options', function() {
            w.addFunction('foo', function() {}, {foo: true}).should.be.an.instanceof(Error);
            w.addFunction('foo', function() {}, {toStringEncoding: 'InVaLiD'}).should.be.an.instanceof(Error);
        })
        it('should return error when no callback given', function() {
            w.addFunction('reverse').should.be.an.instanceof(Error);
        })
        it('should send corresponding packet', function(done) {
            w.jobServers[0].send = function(buff) {
                var packetType = buff.readUInt32BE(4);
                packetType.should.equal(protocol.PACKET_TYPES.CAN_DO);
                done();
            }
            w.addFunction('reverse', function() {});
        })
        it('with timeout should send corresponding packet', function(done) {
            w.jobServers[0].send = function(buff) {
                var packetType = buff.readUInt32BE(4);
                packetType.should.equal(protocol.PACKET_TYPES.CAN_DO_TIMEOUT);
                done();
            }
            w.addFunction('reverse', function() {}, {timeout: 10});
        })
    })


    describe('#removeFunction', function() {
        it('should unset many managing values', function() {
            w.addFunction('reverse', function() {});
            w.removeFunction('reverse');
            Object.keys(w.functions).length.should.equal(0);
            should.not.exist(w.functions.reverse);
            w.jobServers[0].send.calledTwice.should.be.true; // addRunction + removeFunction
        })
        it('should return error when function name not known', function() {
            w.addFunction('foo', function() {});
            w.removeFunction('bar').should.be.an.instanceof(Error);
        })
        it('should return error when invalid function name', function() {
            w.removeFunction(undefined).should.be.an.instanceof(Error);
            w.removeFunction(null).should.be.an.instanceof(Error);
            w.removeFunction('').should.be.an.instanceof(Error);
        })
        it('should send packet to job server', function() {
            w.addFunction('foo', function() {});
            w.removeFunction('foo');
            w.jobServers[0].send.calledTwice.should.be.true; // add + remove
        })
    })


    describe('#resetAbilities', function() {
        it('should send packet to job server', function() {
            w.resetAbilities();
            w.jobServers[0].send.calledOnce.should.be.true;
        })
    })


    describe('#setWorkerId', function() {
        it('should return error when invalid workerId', function() {
            w.setWorkerId().should.be.an.instanceof(Error);
            w.setWorkerId(null).should.be.an.instanceof(Error);
            w.setWorkerId('').should.be.an.instanceof(Error);
            should.not.exist(w.setWorkerId('id')); // returns 'null' if validation ok
        })
        it('should set workerId option on worker', function() {
            should.not.exist(w.workerId);
            w.setWorkerId('id');
            w.workerId.should.equal('id');
        })
        it('should invoke `send` on job server', function() {
            w.setWorkerId('id');
            w.jobServers[0].send.calledOnce.should.be.true;
        })
        it('should send corresponding packet to job server', function(done) {
              w.jobServers[0].send = function(buff) {
                var packetType = buff.readUInt32BE(4);
                packetType.should.equal(protocol.PACKET_TYPES.SET_CLIENT_ID);
                done();
            }
            w.setWorkerId('id');
        })
    })

    describe('#_response', function() {
        it('should send GRAB_JOB when NOOP received', function(done) {
            w.jobServers[0].send = function(buff) {
                var packetType = buff.readUInt32BE(4);
                packetType.should.equal(protocol.PACKET_TYPES.GRAB_JOB);
                done();
            }
            w._response(w.jobServers[0], protocol.PACKET_TYPES.NOOP);
        })
        it('should send GRAB_JOB_UNIQ when NOOP received', function(done) {
            w.withUnique = true;
            w.jobServers[0].send = function(buff) {
                var packetType = buff.readUInt32BE(4);
                packetType.should.equal(protocol.PACKET_TYPES.GRAB_JOB_UNIQ);
                done();
            }
            w._response(w.jobServers[0], protocol.PACKET_TYPES.NOOP);
        })
    })


    describe('#Job', function() {

        describe('#workComplete', function() {
            it('should send packets to job server', function() {
                j.workComplete();
                w.jobServers[0].send.calledOnce.should.be.true;
                w._preSleep.calledOnce.should.be.true;
                w.jobServers[0].send.calledBefore(w._preSleep).should.be.true;
                j.closed.should.be.true;
            })
        })


        describe('#sendWorkData', function() {
            it('should send packet to job server', function() {
                j.sendWorkData('foo');
                w.jobServers[0].send.calledOnce.should.be.true;
                should.not.exist(j.closed);
            })
        })


        describe('#reportStatus', function() {
            it('should send packet to job server', function() {
                j.reportStatus(1, 2);
                w.jobServers[0].send.calledOnce.should.be.true;
                should.not.exist(j.closed);
            })
            it('should validate given parameters', function() {
                j.reportStatus().should.be.an.instanceof(Error);
                j.reportStatus(1).should.be.an.instanceof(Error);
                j.reportStatus(1, null).should.be.an.instanceof(Error);
                j.reportStatus(1, '').should.be.an.instanceof(Error);
                j.reportStatus('1', '2').should.be.an.instanceof(Error);
                w.jobServers[0].send.called.should.be.false;
            })
        })


        describe('#reportWarning', function() {
            it('should send packet to job server', function() {
                j.reportWarning('foo');
                w.jobServers[0].send.calledOnce.should.be.true;
                should.not.exist(j.closed);
            })
        })


        describe('#reportError', function() {
            it('should send packet to job server', function() {
                j.reportError();
                w.jobServers[0].send.calledOnce.should.be.true;
                w._preSleep.calledOnce.should.be.true;
                w.jobServers[0].send.calledBefore(w._preSleep).should.be.true;
                j.closed.should.be.true;
            })
        })


        describe('#reportException', function() {
            it('should send packet to job server', function() {
                j.reportException('NullPointerException#something cannot be null');
                w.jobServers[0].send.calledOnce.should.be.true;
                w._preSleep.calledOnce.should.be.true;
                w.jobServers[0].send.calledBefore(w._preSleep).should.be.true;
                j.closed.should.be.true;
            })
        })
    })

})
