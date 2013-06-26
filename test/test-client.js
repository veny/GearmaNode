var should     = require('should'),
    gearmanode = require('../lib/gearmanode'),
    Client     = gearmanode.Client,
    Job        = gearmanode.Job,
    JobServer  = require('../lib/gearmanode/job-server').JobServer;


describe('Client', function() {


    describe('#factory', function() {
        it('should return instance of Client', function() {
            var c = gearmanode.client();
            c.should.be.an.instanceof(Client);
            should.exist(c.jobServers);
            should.exist(c.jobs);
            Object.keys(c.jobs).length.should.equal(0);
        })
        it('should return error when an unknown option found', function() {
            gearmanode.client({ pipapo: 1 }).should.be.an.instanceof(Error);
        })
        it('should return client with default job server', function() {
            var c = gearmanode.client();
            c.jobServers.length.should.equal(1);
            c.jobServers[0].host.should.equal('localhost');
            c.jobServers[0].port.should.equal(4730);
            var noOpts = [null, {}];
            for (var i = 0; i < noOpts.length; i ++) {
                c = gearmanode.client(noOpts[i]);
                c.jobServers.length.should.equal(1);
                c.jobServers[0].host.should.equal('localhost');
                c.jobServers[0].port.should.equal(4730);
            }
        })
        it('should return client with corresponding job server', function() {
            var c = gearmanode.client({ host: 'test.com', port: 4444 });
            c.jobServers.length.should.equal(1);
            c.jobServers[0].should.be.an.instanceof(JobServer);
            c.jobServers[0].host.should.equal('test.com');
            c.jobServers[0].port.should.equal(4444);
        })
        it('should return error when servers not/empty array', function() {
            gearmanode.client({ servers: 1 }).should.be.an.instanceof(Error);
            gearmanode.client({ servers: [] }).should.be.an.instanceof(Error);
        })
        it('should return error when servers are duplicate', function() {
            var c = gearmanode.client({ servers: [{host: 'localhost'}, {host: 'localhost'}] });
            c.should.be.an.instanceof(Error);
        })
        it('should return client with corresponding job servers', function() {
            var c = gearmanode.client({ servers: [{ host: 'foo.com'}, { port: 4444 }] });
            c.jobServers.length.should.equal(2);
            c.jobServers[0].should.be.an.instanceof(JobServer);
            c.jobServers[0].host.should.equal('foo.com');
            c.jobServers[0].port.should.equal(4730);
            c.jobServers[1].should.be.an.instanceof(JobServer);
            c.jobServers[1].host.should.equal('localhost');
            c.jobServers[1].port.should.equal(4444);
        })
    })



    describe('#close', function() {
        it('should clean up object', function() {
            var c = gearmanode.client();
            c.jobs['H:lima:207'] = new Job({ name: 'reverse', payload: 'hi' }); // mock the jobs
            Object.keys(c.jobs).length.should.equal(1);
            c.close();
            c.closed.should.be.true;
            Object.keys(c.jobs).length.should.equal(0);
            c.jobServers.length.should.equal(1);
        })
    })

})