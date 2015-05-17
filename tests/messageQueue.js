var expect = require('chai').expect;
var messageQueue = require('../messageQueue.js');

describe('messageQueue', function() {
	'use strict';

	it('converts to an array', function() {
		expect(messageQueue.create().toArray()).to.be.an.instanceOf(Array);
	});

	it('returns an array with the number of elements enqueued', function() {
		var i, j, q;
		for (i = 0; i < 10; i++) {
			q = messageQueue.create();
			for (j = 0; j < i; j++) {
				q.enqueue(null);
			}
			expect(q.toArray()).to.have.length(i);
		}
	});

	it('returns an array with the elements enqueued', function() {
		var i, q, a;
		q = messageQueue.create();
		for (i = 0; i < 10; i++) {
			q.enqueue(i);
		}
		a = q.toArray();
		for (i = 0; i < 10; i++) {
			expect(a[i].message).to.equal(i);
		}
	});

	it('assigns unique ids', function() {
		var i, q, a, ids;

		// enqueue some messages and convert to array
		q = messageQueue.create();
		for (i = 0; i < 10; i++) {
			q.enqueue(i);
		}
		a = q.toArray();

		// check for uniqueness of ids
		ids = [];
		function isUnique(testID) {
			if (ids.some(function(id) {
					return id === testID;
				})) {
				return false;
			} else {
				ids.push(testID);
				return true;
			}
		}

		// check each id
		for (i = 0; i < 10; i++) {
			expect(isUnique(a[i].id)).to.be.equal(true);
		}
	});

	it('clears up to specified item', function() {
		var i, j, q, a;

		for (i = 0; i < 10; i++) {
			// enqueue some messages and convert to array
			q = messageQueue.create();
			for (j = 0; j < 10; j++) {
				q.enqueue(null);
			}
			a = q.toArray();

			// clear up to a specific item and check its length
			q.clear(a[i].id);
			expect(q.toArray()).to.have.length(9 - i);
		}
	});

	it('handles clear-to IDs for items already cleared', function() {
		var i, q, a;

		// enqueue some items
		q = messageQueue.create();
		for (i = 0; i < 10; i++) {
			q.enqueue(null);
		}
		a = q.toArray();

		// clear up to a particular item, then repeat and check length
		q.clear(a[4].id);
		q.clear(a[4].id);
		expect(q.toArray()).to.have.length(5);
	});

	it('does not clear items for clear-to IDs not in queue', function() {
		var i, q;

		// enqueue some items
		q = messageQueue.create();
		for (i = 0; i < 10; i++) {
			q.enqueue(null);
		}

		// clear up to a non-existent ID, which shouldn't clear anything
		q.clear(1000);
		expect(q.toArray()).to.have.length(10);
	});
});
