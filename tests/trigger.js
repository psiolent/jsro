var expect = require('chai').expect;
var trigger = require('../trigger.js');

describe('trigger', function() {
	'use strict';

	var t;
	beforeEach(function() {
		// create a new trigger for testing
		t  = trigger.create();
	});

	it('does not accept invalid argument types', function() {
		expect(function() {
			t.on(1, 2);
		}).to.throw(Error);
		expect(function() {
			t.on('e', 2);
		}).to.throw(Error);
		expect(function() {
			t.off(1, 2);
		}).to.throw(Error);
		expect(function() {
			t.off('e', 2);
		}).to.throw(Error);
		expect(function() {
			t.fire(1);
		}).to.throw(Error);
	});

	it('can fire events with no listeners', function() {
		t.fire('e');
	});

	it('invokes all listeners for a fired event', function() {
		var c = 0;
		t.on('e', function() {
			c++;
		});
		t.on('e', function() {
			c++;
		});
		t.on('e', function() {
			c++;
		});
		t.fire('e');
		expect(c).to.equal(3);
	});

	it('only invokes listeners registered for the fired event', function() {
		var c = 0;
		t.on('e', function() {
			c++;
		});
		t.on('f', function() {
			c++;
		});
		t.on('g', function() {
			c++;
		});
		t.fire('e');
		expect(c).to.equal(1);
		t.fire('h');
		expect(c).to.equal(1);
	});

	it('does not invoke unregistered listeners', function() {
		var c = 0;
		var f;
		t.on('e', function() {
			c++;
		});
		t.on('e', f = function() {
			c++;
		});
		t.on('e', function() {
			c++;
		});
		t.off('e', f);
		t.fire('e');
		expect(c).to.equal(2);
	});

	it('does not invoke any listeners after all are unregistered', function() {
		var c = 0;
		t.on('e', function() {
			c++;
		});
		t.on('e', function() {
			c++;
		});
		t.on('e', function() {
			c++;
		});
		t.off('e');
		t.fire('e');
		expect(c).to.equal(0);
	});

	it('unregisters listeners that are not actually registered', function() {
		t.off('a');
		t.off('a', function() {
		});
		t.on('a', function() {
		});
		t.off('a', function() {
		});
	});

	it('passes arguments to listeners', function() {
		var a = [1, 'hello', {}];
		var p = undefined;
		t.on('e', function() {
			p = Array.prototype.slice.call(arguments, 0);
		});
		t.fire('e', a[0], a[1], a[2]);
		expect(p).to.deep.equal(a);
	});
});
