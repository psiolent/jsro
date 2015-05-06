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

	// create our message queue
	var messages = messageQueue.create();

	// deferred response, for when a request is made but nothing is the in queue
	var deferredResponse;

	connection.receive = function(message) {

	};

	/**
	 * Requests the array of pending messages to be sent to the client on the
	 * other side of this connection.
	 * @returns {promise} a promise for the messages to be sent
	 */
	connection.request = function() {
		// if we already have an outstanding request, reject it
		if (deferredResponse) {
			deferredResponse.reject(
				'new request received before this request was fulfilled'
			);
		}

		// get what we've got in the queue
		var pendingMessages = messages.toArray();
		if (pendingMessages.length === 0) {
			// nothing pending, so create a promise for next message
			deferredResponse = Q.defer();
			return deferredResponse.promise;
		} else {
			// send out pending messages now
			deferredResponse = undefined;
			return Q(pendingMessages);
		}
	};

	connection.disconnect = function() {

	};

	// return the connection object
	return connection;
};
