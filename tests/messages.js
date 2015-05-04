var expect = require('chai').expect;
var messages = require('../messages.js');

describe('messages', function() {
	'use strict';

	it('should convert to an array', function() {
		expect(messages.createQueue().toArray()).to.be.an.instanceOf(Array);
	});

	it('should return an array with the number of elements enqueued', function() {
		var i, j, q;
		for (i = 0; i < 10; i++) {
			q = messages.createQueue();
			for (j = 0; j < i; j++) {
				q.enqueue(null);
			}
			expect(q.toArray()).to.have.length(i);
		}
	});

	it('should return an array with the elements enqueued', function() {
		var i, q, a;
		q = messages.createQueue();
		for (i = 0; i < 10; i++) {
			q.enqueue(i);
		}
		a = q.toArray();
		for (i = 0; i < 10; i++) {
			expect(a[i].message).to.equal(i);
		}
	});

	it('should assign unique ids', function() {
		var i, q, a, ids;

		// enqueue some messages and convert to array
		q = messages.createQueue();
		for (i = 0; i < 10; i++) {
			q.enqueue(i);
		}
		a = q.toArray();

		// check for uniqueness of ids
		ids = [];
		function isUnique(testID) {
			if (ids.some(function(id) { return id === testID; })) {
				return false;
			} else {
				ids.push(testID);
				return true;
			}
		}

		// check each id
		for (i = 0; i < 10; i++) {
			expect(isUnique(a[i].id)).to.be.true;
		}
	});

	it('should clear up to specified item', function() {
		var i, j, q, a;

		for (i = 0; i < 10; i++) {
			// enqueue some messages and convert to array
			q = messages.createQueue();
			for (j = 0; j < 10; j++) {
				q.enqueue(null);
			}
			a = q.toArray();

			// clear up to a specific item and check its length
			q.clear(a[i].id);
			expect(q.toArray()).to.have.length(9 - i);
		}
	});
});
