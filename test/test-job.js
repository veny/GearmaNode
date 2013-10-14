var should     = require('should'),
    sinon      = require('sinon'),
    events     = require('events'),
    gearmanode = require('../lib/gearmanode'),
    Job        = require('../lib/gearmanode/job').Job,
    protocol   = require('../lib/gearmanode/protocol');


describe('Job', function() {
    var c, j;
    beforeEach(function() {
        c = gearmanode.client();
        j = new Job(c, { name: 'reverse', payload: 'hi' });
        j.emit = sinon.spy();
    });

    describe('#constructor', function() {
        it('should return default instance of Job', function() {
            j.should.be.an.instanceof(Job);
            j.clientOrWorker.should.be.an.instanceof(gearmanode.Client);
            events.EventEmitter.listenerCount(j.clientOrWorker, 'close').should.equal(1);
            j.name.should.equal('reverse');
            j.payload.should.equal('hi');
            j.background.should.be.false;
            j.priority.should.equal('NORMAL');
            j.encoding.should.equal('utf8');
            should.not.exist(j.jobServer);
        })
        it('should return special instance of Job', function() {
            var job = new Job(c,
                { name: 'reverse', payload: 'hi', background: true, priority: 'HIGH', encoding: 'ascii' }
            );
            job.should.be.an.instanceof(Job);
            job.name.should.equal('reverse');
            job.payload.should.equal('hi');
            job.background.should.be.true;
            job.priority.should.equal('HIGH');
            job.encoding.should.equal('ascii');
        })
        it('should return error when missing mandatory options', function() {
            var job = new Job();
            job.should.be.an.instanceof(Error);
            job = new Job(null);
            job.should.be.an.instanceof(Error);
            job = new Job(c);
            job.should.be.an.instanceof(Error);
            job = new Job(c, true);
            job.should.be.an.instanceof(Error);
            job = new Job(c, {});
            job.should.be.an.instanceof(Error);
            job = new Job(c, { name: 'foo' });
            job.should.be.an.instanceof(Error);
            job = new Job(c, { payload: 'foo' });
            job.should.be.an.instanceof(Error);
        })
        it('should return error when incorrect options', function() {
            var job = new Job(c, { name: 'foo', payload: 'bar', background: 'baz' });
            job.should.be.an.instanceof(Error);
            job = new Job(c, { name: 'foo', payload: 'bar', priority: 'baz' });
            job.should.be.an.instanceof(Error);
            job = new Job(c, { name: 'foo', payload: 'bar', encoding: 'baz' });
            job.should.be.an.instanceof(Error);
        })
    })


    describe('#close', function() {
        it('should clean up object', function() {
            j.handle = 'H:localhost:22';
            j.processing = true;
            j.clientOrWorker.jobs[j.handle] = j;
            j.close();
            j.processing.should.be.false;
            j.closed.should.be.true;
            should.not.exist(c.jobs[j.handle]);
            should.not.exist(j.clientOrWorker);
        })
        it('should emit event on itself', function() {
            j.close();
            j.emit.calledOnce.should.be.true;
            j.emit.calledWith('close').should.be.true;
        })
        it('should remove all listeners', function() {
            j.on('created', function() {});
            j.on('close', function() {});
            events.EventEmitter.listenerCount(j, 'created').should.equal(1);
            events.EventEmitter.listenerCount(j, 'close').should.equal(1);
            j.close();
            events.EventEmitter.listenerCount(j, 'created').should.equal(0);
            events.EventEmitter.listenerCount(j, 'close').should.equal(0);
        })
        it('should emit `close` event on itself if associated Client/Worker is closed', function() {
            c.close();
            j.emit.calledOnce.should.be.true;
            j.emit.calledWith('close').should.be.true;
        })
    })


    describe('#getPacketType', function() {
        it('should return correct packet type', function() {
            var job = new Job(c, { name: 'reverse', payload: 'hi' });
            job.getPacketType().should.equal(protocol.PACKET_TYPES.SUBMIT_JOB);
            job = new Job(c, { name: 'reverse', payload: 'hi', priority: 'LOW' });
            job.getPacketType().should.equal(protocol.PACKET_TYPES.SUBMIT_JOB_LOW);
            job = new Job(c, { name: 'reverse', payload: 'hi', priority: 'HIGH'  });
            job.getPacketType().should.equal(protocol.PACKET_TYPES.SUBMIT_JOB_HIGH);
            job = new Job(c, { name: 'reverse', payload: 'hi', background: true });
            job.getPacketType().should.equal(protocol.PACKET_TYPES.SUBMIT_JOB_BG);
            job = new Job(c, { name: 'reverse', payload: 'hi', background: true, priority: 'LOW' });
            job.getPacketType().should.equal(protocol.PACKET_TYPES.SUBMIT_JOB_LOW_BG);
            job = new Job(c, { name: 'reverse', payload: 'hi', background: true, priority: 'HIGH'  });
            job.getPacketType().should.equal(protocol.PACKET_TYPES.SUBMIT_JOB_HIGH_BG);
        })
    })

})
