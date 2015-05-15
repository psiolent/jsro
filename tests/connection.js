var expect = require('chai').expect;
var Q = require('q');
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
			action: 'create',
			name: name,
			spec: spec
		});
	}

	function destroy(requestID, instanceID) {
		c.receive({
			requestID: requestID,
			action: 'destroy',
			instanceID: instanceID
		});
	}

	function invoke(requestID, instanceID, method, args) {
		c.receive({
			requestID: requestID,
			action: 'invoke',
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
			expect(messages[0].message.error).to.exist;
			expect(messages[1].message.error).to.exist;
			expect(messages[2].message.error).to.exist;
			done();
		}).catch(function(e) {
			done(e);
		});
	});

	it('returns an error when creating unknown instance', function(done) {
		create(0, 'name');
		c.request().then(function(messages) {
			expect(messages[0].message.error).to.exist;
			done();
		}).catch(function(e) {
			done(e);
		});
	});

	it('returns an error when destroying unknown instance', function(done) {
		create(0, 'name');
		c.request().then(function(messages) {
			expect(messages[0].message.error).to.exist;
			done();
		}).catch(function(e) {
			done(e);
		});
	});

	it('returns an error when invoking unknown instance', function(done) {
		create(0, 'name');
		c.request().then(function(messages) {
			expect(messages[0].message.error).to.exist;
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
			done('messages promise was resolved, not rejected');
		}).catch(function() {
			done();
		});
		c.request();
	});

	it('rejects messages promise when disconnecting', function(done) {
		c.request().then(function(messages) {
			done('messages promise was resolved, not rejected');
		}).catch(function() {
			done();
		});
		c.disconnect();
	});

	it('creates instances synchronously', function(done) {
		factories.foo = function() {
			return {};
		};
		create(0, 'foo');
		c.request().then(function(messages) {
			expect(messages[0].message.instanceID).to.exist;
			done();
		}).catch(function(e) {
			done(e);
		});
	});

	it('creates instances asynchronously', function(done) {
		factories.foo = function() {
			return Q.when({});
		};
		create(0, 'foo');
		c.request().then(function(messages) {
			expect(messages[0].message.instanceID).to.exist;
			done();
		}).catch(function(e) {
			done(e);
		});
	});

	it('returns error thrown during creation', function(done) {
		factories.foo = function() {
			throw 'no';
		};
		create(0, 'foo');
		c.request().then(function(messages) {
			expect(messages[0].message.error).to.exist;
			done();
		}).catch(function(e) {
			done(e);
		});
	});

	it('returns error for rejected promise creation', function(done) {
		factories.foo = function() {
			var def = Q.defer();
			def.reject('no');
			return def.promise;
		};
		create(0, 'foo');
		c.request().then(function(messages) {
			expect(messages[0].message.error).to.exist;
			done();
		}).catch(function(e) {
			done(e);
		});
	});

	it('returns error for non-object instance', function(done) {
		factories.foo = function() {
			return 42;
		};
		create(0, 'foo');
		c.request().then(function(messages) {
			expect(messages[0].message.error).to.exist;
			done();
		}).catch(function(e) {
			done(e);
		});
	});

	it('assigns unique instance IDs', function(done) {
		factories.foo = function() {
			return {};
		};
		for (var i = 0; i < 10; i++) {
			create(i, 'foo');
		}
		var ids = [];

		function checkUniqueID(msg) {
			var instanceID = msg.message.instanceID;
			if (ids.some(function(id) {
					return instanceID === id;
				})) {
				throw 'id ' + id + ' is not unique';
			}
			ids.push(msg.message.instanceID);
		}

		c.request().then(function(messages) {
			messages.forEach(checkUniqueID);
			done();
		}).catch(function(e) {
			done(e);
		});
	});

	it('forwards instance spec upon creation', function(done) {
		var spec = {spec: 'spec'};
		factories.foo = function(context) {
			expect(context.spec).to.deep.equal(spec);
			return {};
		};
		create(0, 'foo', spec);
		c.request().then(function(messages) {
			expect(messages[0].message.instanceID).to.exist;
			done();
		}).catch(function(e) {
			done(e);
		});
	});

	it('forwards connection data upon creation', function(done) {
		data.data = 'data';
		factories.foo = function(context) {
			expect(context.connection.data).to.equal('data');
			return {};
		};
		create(0, 'foo');
		c.request().then(function(messages) {
			expect(messages[0].message.instanceID).to.exist;
			done();
		}).catch(function(e) {
			done(e);
		});
	});

	it('returns instance methods', function(done) {
		var methods = ['a', 'b', 'c'];
		var fields = ['d', 'e', 'f'];
		factories.foo = function() {
			var inst = {};
			methods.forEach(function(m) {
				inst[m] = function() {
				};
			});
			fields.forEach(function(f) {
				inst[f] = f;
			});
			return inst;
		};
		create(0, 'foo');
		c.request().then(function(messages) {
			var instMethods = messages[0].message.methods;
			methods.forEach(function(m) {
				expect(instMethods).to.contain(m);
			});
			fields.forEach(function(f) {
				expect(instMethods).not.to.contain(f);
			});
			done();
		}).catch(function(e) {
			done(e);
		});
	});

	it('invokes methods of instances', function(done) {
		var def = Q.defer();
		factories.foo = function() {
			return {
				bar: function() {
					done();
				}
			};
		};
		create(0, 'foo');
		c.request().then(function(messages) {
			var instanceID = messages[0].message.instanceID;
			invoke(1, instanceID, 'bar', []);
		}).catch(function(e) {
			done(e);
		});
	});

	it('returns an error for unknown method invocation', function(done) {
		factories.foo = function() {
			return {};
		};
		create(0, 'foo');
		c.request().then(function(messages) {
			var instanceID = messages[0].message.instanceID;
			invoke(1, instanceID, 'bar', []);
			return c.request(messages[0].id);
		}).then(function(messages) {
			expect(messages[0].message.error).to.exist;
			done();
		}).catch(function(e) {
			done(e);
		});
	});

	it('rejects non-array invocation arguments', function(done) {
		factories.foo = function() {
			return {};
		};
		create(0, 'foo');
		c.request().then(function(messages) {
			var instanceID = messages[0].message.instanceID;
			invoke(1, instanceID, 'bar', 'negative');
			return c.request(messages[0].id);
		}).then(function(messages) {
			expect(messages[0].message.error).to.exist;
			done();
		}).catch(function(e) {
			done(e);
		});
	});

	it('returns synchronous method results', function(done) {
		var result = {result: 'result'};
		factories.foo = function() {
			return {
				bar: function() {
					return result;
				}
			};
		};
		create(0, 'foo');
		c.request().then(function(messages) {
			var instanceID = messages[0].message.instanceID;
			invoke(1, instanceID, 'bar', []);
			return c.request(messages[0].id);
		}).then(function(messages) {
			expect(messages[0].message.result).to.deep.equal(result);
			done();
		}).catch(function(e) {
			done(e);
		});
	});

	it('returns asynchronous method results', function(done) {
		var result = {result: 'result'};
		factories.foo = function() {
			return {
				bar: function() {
					var def = Q.defer();
					def.resolve(result);
					return def.promise;
				}
			};
		};
		create(0, 'foo');
		c.request().then(function(messages) {
			var instanceID = messages[0].message.instanceID;
			invoke(1, instanceID, 'bar', []);
			return c.request(messages[0].id);
		}).then(function(messages) {
			expect(messages[0].message.result).to.deep.equal(result);
			done();
		}).catch(function(e) {
			done(e);
		});
	});

	it('returns synchronous method errors', function(done) {
		var error = {error: 'error'};
		factories.foo = function() {
			return {
				bar: function() {
					throw error;
				}
			};
		};
		create(0, 'foo');
		c.request().then(function(messages) {
			var instanceID = messages[0].message.instanceID;
			invoke(1, instanceID, 'bar', []);
			return c.request(messages[0].id);
		}).then(function(messages) {
			expect(messages[0].message.error).to.deep.equal(error);
			done();
		}).catch(function(e) {
			done(e);
		});
	});

	it('returns asynchronous method rejections', function(done) {
		var error = {error: 'error'};
		factories.foo = function() {
			return {
				bar: function() {
					var def = Q.defer();
					def.reject(error);
					return def.promise;
				}
			};
		};
		create(0, 'foo');
		c.request().then(function(messages) {
			var instanceID = messages[0].message.instanceID;
			invoke(1, instanceID, 'bar', []);
			return c.request(messages[0].id);
		}).then(function(messages) {
			expect(messages[0].message.error).to.deep.equal(error);
			done();
		}).catch(function(e) {
			done(e);
		});
	});

	it('fires events', function(done) {
		var def = Q.defer();
		factories.foo = function(context) {
			def.promise.then(function() {
				context.fire('event');
			});
			return {};
		};
		create(0, 'foo');
		c.request().then(function(messages) {
			def.resolve(true);
			return c.request(messages[0].id);
		}).then(function(messages) {
			expect(messages[0].message.event).to.equal('event');
			done();
		}).catch(function(e) {
			done(e);
		});
	});

	it('passes arguments when firing events', function(done) {
		var args = [0, 'a', {}];
		var def = Q.defer();
		factories.foo = function(context) {
			def.promise.then(function() {
				context.fire('event', args[0], args[1], args[2]);
			});
			return {};
		};
		create(0, 'foo');
		c.request().then(function(messages) {
			def.resolve(true);
			return c.request(messages[0].id);
		}).then(function(messages) {
			expect(messages[0].message.args).to.deep.equal(args);
			done();
		}).catch(function(e) {
			done(e);
		});
	});

	it('will not fire events before instantiated', function(done) {
		factories.foo = function(context) {
			context.fire('event');
			return {};
		};
		create(0, 'foo');
		c.request().then(function(messages) {
			expect(messages[0].message.error).to.exist;
			done();
		}).catch(function(e) {
			done(e);
		});
	});

	it('will acknowledge instance destruction', function(done) {
		factories.foo = function(context) {
			return {};
		};
		create(0, 'foo');
		c.request().then(function(messages) {
			destroy(1, messages[0].message.instanceID);
			return c.request(messages[0].id);
		}).then(function(messages) {
			expect(messages[0].message.requestID).to.equal(1);
			done();
		}).catch(function(e) {
			done(e);
		});
	});

	it('notifies instances when destroyed', function(done) {
		factories.foo = function(context) {
			context.on('destroy', function() {
				done();
			});
			return {};
		};
		create(0, 'foo');
		c.request().then(function(messages) {
			destroy(1, messages[0].message.instanceID);
		}).catch(function(e) {
			done(e);
		});
	});

	it('will not invoke instances after destruction', function(done) {
		factories.foo = function(context) {
			return {};
		};
		create(0, 'foo');
		c.request().then(function(messages) {
			destroy(1, messages[0].message.instanceID);
			invoke(2, messages[0].message.instanceID, 'bar', []);
			return c.request(messages[0].id);
		}).then(function(messages) {
			expect(messages[1].message.error).to.exist;
			done();
		}).catch(function(e) {
			done(e);
		});
	});

	it('will not send results after destruction', function(done) {
		var def = Q.defer();
		factories.foo = function() {
			return {
				bar: function() {
					return def.promise;
				}
			};
		};
		create(0, 'foo');
		c.request().then(function(messages) {
			var instanceID = messages[0].message.instanceID;
			invoke(1, instanceID, 'bar', []);
			destroy(2, instanceID);
			def.resolve(4);
			return c.request(messages[0].id);
		}).then(function(messages) {
			expect(messages).to.have.length(1);
			c.receive({requestID: 3});
			return c.request(messages[0].id);
		}).then(function(messages) {
			expect(messages).to.have.length(1);
			done();
		}).catch(function(e) {
			done(e);
		});
	});

	it('will not fire events after destruction', function(done) {
		var def = Q.defer();
		factories.foo = function(context) {
			def.promise.then(function() {
				context.fire('event');
			}).catch(function(e) {
				done();
			});
			return {};
		};
		create(0, 'foo');
		c.request().then(function(messages) {
			var instanceID = messages[0].message.instanceID;
			destroy(2, instanceID);
			def.resolve(22);
		}).catch(function(e) {
			done(e);
		});
	});

	it('destroys instances when disconnected', function(done) {
		factories.foo = function(context) {
			context.on('destroy', function() {
				done();
			});
			return {};
		};
		create(0, 'foo');
		c.request().then(function(messages) {
			c.disconnect();
		}).catch(function(e) {
			done(e);
		});
	});

	it('will not receive when disconnected', function() {
		c.disconnect();
		expect(function() { c.receive(); }).to.throw(Error);
	});

	it('will not handle requests when disconnected', function() {
		c.disconnect();
		expect(function() { c.request(); }).to.throw(Error);
	});

	it('will not disconnect when disconnected', function() {
		c.disconnect();
		expect(function() { c.disconnect(); }).to.throw(Error);
	});

});
