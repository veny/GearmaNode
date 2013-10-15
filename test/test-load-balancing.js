
var should     = require('should'),
    util       = require('util'),
    Sequence   = require('../lib/gearmanode/load-balancing').Sequence;

describe('load-balancing', function() {
    var lb;
    beforeEach(function() {
        lb = new Sequence(2);
    });


    describe('#LBStrategy', function() {


        describe('#badOne', function() {
            it('should store given index with timestamp', function() {
                Object.keys(lb.badNodes).length.should.equal(0);
                lb.badOne(1);
                Object.keys(lb.badNodes).length.should.equal(1);
                lb.badNodes.should.have.ownProperty(1);
                lb.badNodes[1].should.be.an.instanceof(Date);
            })
            it('should ignore index bigger than node count', function() {
                Object.keys(lb.badNodes).length.should.equal(0);
                lb.badOne(2);
                Object.keys(lb.badNodes).length.should.equal(0);
            })
            it('should accept only number', function() {
                Object.keys(lb.badNodes).length.should.equal(0);
                lb.badOne('0');
                Object.keys(lb.badNodes).length.should.equal(0);
                lb.badOne(null);
                Object.keys(lb.badNodes).length.should.equal(0);
                lb.badOne(false);
                Object.keys(lb.badNodes).length.should.equal(0);
            })
        })
    })


    describe('#Sequence', function() {


        describe('#nextIndex', function() {
            it('should return the same index if everything OK', function() {
                lb.nextIndex().should.equal(0);
                lb.nextIndex().should.equal(0);
                lb.nextIndex().should.equal(0);
            })
            it('should return next index if the current fails', function() {
                lb.badOne(0);
                lb.nextIndex().should.equal(1);
                lb.nextIndex().should.equal(1);
            })
            it('should return null if all nodes fails', function() {
                lb.nextIndex().should.equal(0);
                lb.badOne(0);
                lb.badOne(1);
                should.not.exist(lb.nextIndex());
            })
        })

    })

})