
var should     = require('should'),
    util       = require('util'),
    Sequence   = require('../lib/gearmanode/load-balancing').Sequence;

describe('load-balancing', function() {


    describe('#LBStrategy', function() {


        describe('#badOne', function() {
            it('should store given index with timestamp', function() {
                var lb = new Sequence(2);
                Object.keys(lb.badNodes).length.should.equal(0);
                lb.badOne(1);
                Object.keys(lb.badNodes).length.should.equal(1);
                lb.badNodes.should.have.ownProperty(1);
                lb.badNodes[1].should.be.an.instanceof(Date);
            })
            it('should ignore index bigger than node count', function() {
                var lb = new Sequence(2);
                Object.keys(lb.badNodes).length.should.equal(0);
                lb.badOne(2);
                Object.keys(lb.badNodes).length.should.equal(0);
            })
        })
    })


    describe('#Sequence', function() {


        describe('#nextIndex', function() {
            it('should return the same index if everything OK', function() {
                var lb = new Sequence(2);
                lb.nextIndex().should.equal(0);
                lb.nextIndex().should.equal(0);
                lb.nextIndex().should.equal(0);
            })
            it('should return next index if the current fails', function() {
                var lb = new Sequence(2);
                lb.badOne(0);
                lb.nextIndex().should.equal(1);
                lb.nextIndex().should.equal(1);
            })
            it('should return null if all nodes fails', function() {
                var lb = new Sequence(2);
                lb.nextIndex().should.equal(0);
                lb.badOne(0);
                lb.badOne(1);
                should.not.exist(lb.nextIndex());
            })
        })

    })

})