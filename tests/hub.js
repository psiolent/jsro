var expect = require('chai').expect;
var hub = require('../hub.js');

describe('hub', function() {
	'use strict';

	var h;
	beforeEach(function() {
		// create a new hub for testing
		h = hub.create();
	});

	it('registers factory functions', function() {
		h.factory('foo', function() { return {}; });
	});

	it('does not accept invalid argument types', function() {
		expect(function() {
			h.factory(5, function() {
			});
		}).to.throw(Error);
		expect(function() {
			h.factory('foo', 5);
		}).to.throw(Error);
	});

	it('creates new connections', function() {
		h.connect();
	});

	it('creates unique connection IDs', function() {
		var ids = {};
		for (var i = 0; i < 10; i++) {
			var id = h.connect();
			if (ids[id]) {
				throw 'non-unique connection ID: ' + id;
			}
			ids[id] = true;
		}
	});

	it('disconnects established connections', function() {
		var id = h.connect();
		h.disconnect(id);
	});

	it('will not disconnect invalid connection IDs', function() {
		expect(function() {
			h.disconnect(42);
		}).to.throw(Error);
	});

	it('will not disconnect connections already disconnected', function() {
		var id = h.connect();
		h.disconnect(id);
		expect(function() {
			h.disconnect(id);
		}).to.throw(Error);
	});

	it('will not receive for invalid connection IDs', function() {
		expect(function() {
			h.receive(42);
		}).to.throw(Error);
	});

	it('will not receive for connections already disconnected', function() {
		var id = h.connect();
		h.disconnect(id);
		expect(function() {
			h.receive(id);
		}).to.throw(Error);
	});

	it('will not request for invalid connection IDs', function() {
		expect(function() {
			h.request(42);
		}).to.throw(Error);
	});

	it('will not request for connections already disconnected', function() {
		var id = h.connect();
		h.disconnect(id);
		expect(function() {
			h.request(id);
		}).to.throw(Error);
	});

	it('provides factories to connections', function(done) {
		h.factory('foo', function() {
			done();
		});
		var id = h.connect();
		h.receive(id, {
			requestID: 0,
			action: 'create',
			name: 'foo'
		});
	});

	it('forwards receives and requests to connections', function(done) {
		var id = h.connect();
		h.receive(id, {
			requestID: 0
		});
		h.request(id).then(function(messages) {
			expect(messages[0].message.requestID).to.equal(0);
			done();
		}).catch(function(error) {
			done(error);
		});
	});

	it('provides connection data to connections', function(done) {
		var data = {data: 'data'};
		h.factory('foo', function(context) {
			expect(context.connection).to.deep.equal(data);
			return {};
		});

		var id = h.connect(data);
		h.receive(id, {
			requestID: 0,
			action: 'create',
			name: 'foo'
		});
		h.request(id).then(function(messages) {
			expect(messages[0].message.instanceID).to.exist;
			done();
		}).catch(function(error) {
			done(error);
		});
	});
});
