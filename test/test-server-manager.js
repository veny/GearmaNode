var should        = require('should'),
    util          = require('util'),
    sinon         = require('sinon'),
    ServerManager = require('../lib/gearmanode/server-manager').ServerManager,
    JobServer     = require('../lib/gearmanode/job-server').JobServer;


describe('ServerManager', function() {
    var StubKlass = function () {};
    var serMan;
    before(function() {
        ServerManager.mixin(StubKlass);
    });
    beforeEach(function() {
        serMan = new StubKlass();
        serMan._type = 'Client';
        serMan.emit = sinon.spy();
    });


    describe('#mixin', function() {
        it('should mix in methods from ServerManager', function() {
            StubKlass.prototype.initServers.should.be.an.instanceof(Function);
            StubKlass.prototype.closeServers.should.be.an.instanceof(Function);
            StubKlass.prototype._getJobServerByUid.should.be.an.instanceof(Function);
        })
    })


    describe('#initServers', function() {
        it('should return one default server', function() {
            var returned = serMan.initServers();
            should.not.exist(returned);
            should.exist(serMan.jobServers);
            serMan.jobServers.length.should.equal(1);
            should.exist(serMan.jobServers[0].clientOrWorker);
            serMan.jobServers[0].clientOrWorker.should.equal(serMan);
            serMan.jobServers[0].host.should.equal('localhost');
            serMan.jobServers[0].port.should.equal(4730);
        })
        it('should return one specified server', function() {
            var returned = serMan.initServers({host: 'test.com', port: 4444});
            should.not.exist(returned);
            serMan.jobServers.length.should.equal(1);
            serMan.jobServers[0].should.be.an.instanceof(JobServer);
            serMan.jobServers[0].host.should.equal('test.com');
            serMan.jobServers[0].port.should.equal(4444);
        })
        it('should return error when an unknown option found', function() {
            serMan.initServers({unknown: true}).should.be.an.instanceof(Error);
        })
        it('should return error when servers not/empty array', function() {
            serMan.initServers({ servers: 1 }).should.be.an.instanceof(Error);
            serMan.initServers({ servers: [] }).should.be.an.instanceof(Error);
        })
        it('should return error when servers are duplicate', function() {
            serMan.initServers({ servers: [{host: 'localhost'}, {host: 'localhost'}] }).should.be.an.instanceof(Error);
        })
        it('should return corresponding array of job servers', function() {
            serMan.initServers({ servers: [{ host: 'foo.com'}, { port: 4444 }] });
            serMan.jobServers.length.should.equal(2);
            serMan.jobServers[0].should.be.an.instanceof(JobServer);
            serMan.jobServers[0].host.should.equal('foo.com');
            serMan.jobServers[0].port.should.equal(4730);
            serMan.jobServers[1].should.be.an.instanceof(JobServer);
            serMan.jobServers[1].host.should.equal('localhost');
            serMan.jobServers[1].port.should.equal(4444);
        })
    })


    describe('#closeServers', function() {
        it('should clean up object', function() {
            serMan.initServers();
            serMan.jobServers.length.should.equal(1);
            serMan.closeServers();
            serMan.jobServers.length.should.equal(1);
        })
    })

})
