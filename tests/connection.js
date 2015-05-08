var expect = require('chai').expect;
var connection = require('../connection.js');

describe('connection', function() {
	'use strict';

	var c;
	var factories;
	var data;

	beforeEach(function() {
		factories = {};
		data = {};
		c = connection.create(data, function(name, context) {
			return factories[name](context);
		});
	});

	function create(requestID, name, spec) {
		c.receive({
			requestID: requestID,
			name: name,
			spec: spec
		});
	}

	function destroy(requestID, instanceID) {
		c.receive({
			requestID: requestID,
			instanceID: instanceID
		});
	}

	function invoke(requestID, instanceID, method, args) {
		c.receive({
			requestID: requestID,
			instanceID: instanceID,
			method: method,
			args: args
		});
	}

	it('does not respond to requests with invalid request ID', function(done) {
		c.receive({});
		c.receive({requestID: 'a'});
		c.receive({requestID: {}});
		c.receive({requestID: 0});
		c.request().then(function(messages) {
			expect(messages).to.have.length(1);
			done();
		}).catch(function(e) {
			done(e);
		});
	});

	it('responds to requests with correct request ID', function(done) {
		var i;
		for (i = 0; i < 5; i++) {
			c.receive({requestID: i});
		}
		c.request().then(function(messages) {
			expect(messages).to.have.length(5);
			for (i = 0; i < 5; i++) {
				expect(messages[i].message.requestID).to.equal(i);
			}
			done();
		}).catch(function(e) {
			done(e);
		});
	});

	it('returns an error for requests with an invalid action', function(done) {
		c.receive({requestID: 0});
		c.receive({requestID: 1, action: 0});
		c.receive({requestID: 2, action: 'bad'});
		c.request().then(function(messages) {
			expect(messages[0].error).not.to.be.null;
			expect(messages[1].error).not.to.be.null;
			expect(messages[2].error).not.to.be.null;
			done();
		}).catch(function(e) {
			done(e);
		});
	});

	it('returns an error when creating unknown instance', function(done) {
		create(0, 'name');
		c.request().then(function(messages) {
			expect(messages[0].error).not.to.be.null;
			done();
		}).catch(function(e) {
			done(e);
		});
	});

	it('returns an error when destroying unknown instance', function(done) {
		create(0, 'name');
		c.request().then(function(messages) {
			expect(messages[0].error).not.to.be.null;
			done();
		}).catch(function(e) {
			done(e);
		});
	});

	it('returns an error when invoking unknown instance', function(done) {
		create(0, 'name');
		c.request().then(function(messages) {
			expect(messages[0].error).not.to.be.null;
			done();
		}).catch(function(e) {
			done(e);
		});
	});

	it('resends messages if not acknowledged', function(done) {
		c.receive({requestID: 0});
		c.receive({requestID: 1});
		c.receive({requestID: 2});
		c.request().then(function(messages) {
			expect(messages).to.have.length(3);
			return c.request();
		}).then(function(messages) {
			expect(messages).to.have.length(3);
			done();
		}).catch(function(e) {
			done(e);
		});
	});

	it('does not resend acknowledged messages', function(done) {
		c.receive({requestID: 0});
		c.receive({requestID: 1});
		c.receive({requestID: 2});
		c.request().then(function(messages) {
			expect(messages).to.have.length(3);
			return c.request(1);
		}).then(function(messages) {
			expect(messages).to.have.length(1);
			done();
		}).catch(function(e) {
			done(e);
		});
	});

	it('resolves messages promise when messages are ready', function(done) {
		var sent;
		c.request().then(function() {
			expect(sent).to.be.true;
			done();
		}).catch(function(e) {
			done(e);
		});
		sent = true;
		c.receive({requestID: 0});
	});

	it('rejects messages promise when receiving new request', function(done) {
		c.request().then(function(messages) {
			done('messages promise was resolved, not abandoned');
		}).catch(function() {
			done();
		});
		c.request();
	});

	it('rejects messages promise when disconnecting', function(done) {
		c.request().then(function(messages) {
			done('messages promise was resolved, not abandoned');
		}).catch(function() {
			done();
		});
		c.disconnect();
	});
});
