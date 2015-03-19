var should     = require('should'),
    sinon      = require('sinon'),
    events     = require('events'),
    gearmanode = require('../lib/gearmanode'),
    protocol   = require('../lib/gearmanode/protocol'),
    Worker     = gearmanode.Worker,
    Job        = gearmanode.Job,
    JobServer  = require('../lib/gearmanode/job-server').JobServer;


describe('Worker', function() {
    var w, c;

    beforeEach(function() {
        w = gearmanode.worker();
        c = gearmanode.client();
    });
    afterEach(function() {
        w.resetAbilities();
        w.close();
        c.close();
    });


    describe('#submitJob#complete', function() {
        it('should return expected data', function(done) {
            w.addFunction('reverse', function (job) {
                job.payload.should.be.an.instanceof(Buffer);
                job.payload.toString().should.equal('123');
                job.workComplete(job.payload.toString().split("").reverse().join(""))
            });
            var job = c.submitJob('reverse', '123');
            job.on('complete', function() {
                job.response.should.be.an.instanceof(Buffer);
                job.response.toString().should.equal('321');
                done();
            });
        })
        it('should return expected data with diacritic', function(done) {
            w.addFunction('reverse', function (job) {
                job.payload.should.be.an.instanceof(Buffer);
                job.payload.toString().should.equal('žluťoučký kůň');
                job.workComplete(job.payload.toString().split("").reverse().join(""))
            });
            var job = c.submitJob('reverse', 'žluťoučký kůň');
            job.on('complete', function() {
                job.response.should.be.an.instanceof(Buffer);
                job.response.toString().should.equal('ňůk ýkčuoťulž');
                done();
            });
        })
        it('should return expected data as String', function(done) {
            w.addFunction('reverse', function (job) {
                job.payload.should.be.an.instanceof(String);
                job.payload.should.equal('123');
                job.workComplete(job.payload.toString().split("").reverse().join(""))
            }, {toStringEncoding: 'ascii'});
            var job = c.submitJob('reverse', '123', {toStringEncoding: 'ascii'});
            job.on('complete', function() {
                job.response.should.be.an.instanceof(String);
                job.response.should.equal('321');
                done();
            });
        })
        it('should be Buffer on Client and String on Worker', function(done) {
            w.addFunction('reverse', function (job) {
                job.payload.should.be.an.instanceof(String);
                job.payload.should.equal('123');
                job.workComplete(job.payload.toString().split("").reverse().join(""))
            }, {toStringEncoding: 'ascii'});
            var job = c.submitJob('reverse', new Buffer([49, 50, 51])); // '123'
            job.on('complete', function() {
                job.response.should.be.an.instanceof(Buffer);
                job.response.toString().should.equal('321');
                done();
            });
        })
    })

})
