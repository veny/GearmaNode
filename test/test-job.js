var should = require('should'),
    Job    = require('../lib/gearmanode/job').Job;


describe('Job', function() {

    describe('#constructor', function() {
        it('should return instance of Job', function() {
            var job = new Job({ name: 'reverse', payload: 'hi' });
            job.should.be.an.instanceof(Job);
            job.name.should.equal('reverse');
            job.payload.should.equal('hi');
            job.encoding.should.equal('utf-8');
        })
        it('should return error when incorrect options', function() {
            var job = new JobServer({ });
            job.should.be.an.instanceof(Error);
        })
    })

    // describe('#connect', function() {
    //     var js = new JobServer({ host: 'localhost', port: 4730 });

    //     it('should return instance of Socket', function() {
    //         var socket = js.connect(function(e) {console.log('QQ ' + e)});
    //         //should.exist(socket);
    //     })
    // })

})