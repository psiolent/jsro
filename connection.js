var Q = require('q');
var messageQueue = require('./messageQueue');

/**
 * Creates a new connection. A connection represents a path of communication
 * between a remote client and a local set of objects accessible by that client
 * and which the client has specifically instantiated.
 * @param data application specific data associated with the connection
 * @param instantiate an object instantiate function
 */
module.exports.create = function(data, instantiate) {
	'use strict';

	// create the connection object
	var connection = {};

	// next instance ID
	var nextID = 0;

	// our instances
	var instances = [];

	// create our message queue
	var messages = messageQueue.create();

	// deferred response, for when a request is made but nothing is the in queue
	var deferredResponse;

	// record when we are disconnected so we don't do anything else
	var disconnected;

	/**
	 * Receives a message from our remote client.
	 * @param message the received message
	 * @return {} this connection
	 */
	connection.receive = function(message) {
		if (disconnected) {
			throw new Error('no longer connected');
		}

		// make sure we've got a good request ID
		if (typeof message.requestID === 'number') {
			try {
				switch (message.action) {
				case 'create':
					createInstance(
						message.requestID,
						message.name,
						message.spec
					);
					break;
				case 'destroy':
					destroyInstance(
						message.requestID,
						message.instanceID
					);
					break;
				case 'invoke':
					invoke(
						message.requestID,
						message.instanceID,
						message.method,
						message.args
					);
					break;
				default:
					throw new Error('unknown action: ' + message.action);
				}
			} catch (e) {
				// respond with error
				send({
					requestID: message.requestID,
					error: e
				});
			}
		}
		return connection;
	};

	/**
	 * Requests the array of pending messages to be sent to the client on the
	 * other side of this connection.
	 * @param [ackID] the ID of the last message received and acknowledged by
	 * the client
	 * @returns {promise} a promise for the messages to be sent
	 */
	connection.request = function(ackID) {
		if (disconnected) {
			throw new Error('no longer connected');
		}

		// clear up through ackID, if provided
		if (ackID !== undefined) {
			messages.clear(ackID);
		}

		// if we already have an outstanding request, abandon it
		if (deferredResponse) {
			deferredResponse.reject('abandoned');
			deferredResponse = undefined;
		}

		// get what we've got in the queue
		var pendingMessages = messages.toArray();
		if (pendingMessages.length === 0) {
			// nothing pending, so create a promise for next message
			deferredResponse = Q.defer();
			return deferredResponse.promise;
		} else {
			// send out pending messages now
			return Q(pendingMessages);
		}
	};

	/**
	 * Requests that this connection be disconnected.  All instances will be
	 * destroyed and the connection will no longer be usable.
	 * @return {} this connection
	 */
	connection.disconnect = function() {
		if (disconnected) {
			throw new Error('already disconnected');
		}

		disconnected = true;

		// reject any outstanding request
		if (deferredResponse) {
			deferredResponse.reject('disconnected');
			deferredResponse = undefined;
		}

		// destroy all instances
		instances.forEach(function(instance) {
			delete instances[instance.instanceID];
			instance.fire('destroy');
		});

		return connection;
	};

	/**
	 * Creates an instance from the named factory.
	 * @param {number} requestID the ID of the client's request
	 * @param {string} name the name of the factory to use to create the
	 * instance
	 * @param {*} [spec] a creation spec to be passed to the factory function
	 */
	function createInstance(requestID, name, spec) {
		// get the ID of this instance
		var instanceID = nextID++;

		// create a trigger for firing events the instance may want to listen to
		var trigger = require('trigger-maker').create();

		// record when we've been fully instantiated
		var instantiated;

		// create a function for the instance to fire events that the client may
		// want to listen to
		function fire(event) {
			if (typeof event !== 'string') {
				throw new Error('"event" not a string');
			}
			if (!instantiated) {
				// they've fired an event before being fully instantiated
				throw new Error('instantiation not yet complete');
			}
			var args = Array.prototype.slice.call(arguments, 1);
			fireEvent(instanceID, event, args);
		}

		// create a context object to pass to the instance when creating it
		var context = {
			connection: data,
			spec: spec,
			on: trigger.on,
			off: trigger.off,
			fire: fire
		};

		// create the instance and return a promise for it
		return Q.when(instantiate(name, context), function(instance) {
			// make sure instance is actually an object
			if (typeof instance !== 'object') {
				throw new Error('factory ' + name + ' returned non-object');
			}

			instantiated = true;

			// wrap everything up and put it in our instances index
			instances[instanceID] = {
				object: instance,
				instanceID: instanceID,
				fire: trigger.fire
			};

			// collect instance methods
			var methods = [];
			for (var prop in instance) {
				if (instance.hasOwnProperty(prop) &&
					instance[prop] instanceof Function) {
					methods.push(prop);
				}
			}

			// respond with new instance's ID and its methods
			send({
				requestID: requestID,
				instanceID: instanceID,
				methods: methods
			});
		}).catch(function(e) {
			// respond with error
			send({
				requestID: requestID,
				error: e
			});
		});
	}

	/**
	 * Destroys a previously created instance.
	 * @param {number} requestID the ID of the client's request
	 * @param {number} instanceID the ID of the instance to destroy
	 */
	function destroyInstance(requestID, instanceID) {
		// grab the instance and then remove it from the index
		var instance = getInstance(instanceID);
		delete instances[instanceID];

		// let the instance know it's being destroyed
		instance.fire('destroy');

		// and acknowledge that it was destroyed
		send({
			requestID: requestID
		});
	}

	/**
	 * Invokes a method on a created instance.
	 * @param {number} requestID the ID of the client's request
	 * @param {number} instanceID the ID of the instance to invoke a method on
	 * @param {string} method the name of the method to invoke
	 * @param {Array} [args] arguments to pass to the method
	 */
	function invoke(requestID, instanceID, method, args) {
		// get the instance object
		var instance = getInstance(instanceID).object;

		// verify the method name
		if (!instance.hasOwnProperty(method) ||
			!(instance[method] instanceof Function)) {
			throw new Error('invalid method: ' + method);
		}

		// verify arguments
		if (args === undefined) {
			args = [];
		}
		if (!(args instanceof Array)) {
			throw new Error('invalid arguments; should be an array or nothing');
		}

		// invoke it
		Q.when(instance[method].apply(instance, args), function(result) {
			// make sure instance still alive
			if (instances[instanceID]) {
				// send the result
				send({
					requestID: requestID,
					result: result
				});
			}
		}, function(e) {
			// make sure instance still alive
			if (instances[instanceID]) {
				// send the result
				send({
					requestID: requestID,
					error: e
				});
			}
		});
	}

	/**
	 * Fires an event for an instance, to be handled by the client.
	 * @param {number} instanceID the ID of the instance to invoke a method on
	 * @param {string} event the name of the event to fire
	 * @param {Array} args the array of arguments to be passed to the event
	 * listeners
	 */
	function fireEvent(instanceID, event, args) {
		// make sure instance is still active
		if (!instances[instanceID]) {
			throw new Error('instance has been destroyed');
		}

		// send an event message
		send({
			event: event,
			instanceID: instanceID,
			args: args
		});
	}

	/**
	 * Queues a message to be sent to the client.
	 * @param {} message the message to send
	 */
	function send(message) {
		// queue it up
		messages.enqueue(message);

		// and send it now if there is a pending request
		if (deferredResponse) {
			deferredResponse.resolve(messages.toArray());
			deferredResponse = undefined;
		}
	}

	/**
	 * Returns an instance from its ID
	 * @param {number} instanceID the ID of the instance to return
	 * @throws Error if there is no instance for the provided ID
	 */
	function getInstance(instanceID) {
		if (!instances[instanceID]) {
			throw new Error('no such instance: ' + instanceID);
		}
		return instances[instanceID];
	}

	// return the connection object
	return connection;
};
