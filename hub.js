var connection = require('./connection');

/**
 * Creates a new hub object.  A hub manages incoming connections and routes
 * messages to and from connected remote clients.
 */
module.exports.create = function() {
	'use strict';

	// create the hub object
	var hub = {};

	// next connection ID
	var nextID = 0;

	// our current connections
	var connections = [];

	// our registered factories
	var factories = {};

	/**
	 * Registers an object factory that can create requested instances.
	 * @param {string} name the name of the factory
	 * @param {Function} fn the factory function; should accept a single
	 * 'context' argument and return an instance object
	 * @return {} hub object
	 */
	hub.factory = function(name, fn) {
		if (typeof name !== 'string') {
			throw new Error('"name" not a string');
		}
		if (!(fn instanceof Function)) {
			throw new Error('"fn" not a Function');
		}
		factories[name] = fn;
		return hub;
	};

	/**
	 * Accepts an incoming connection.
	 * @param {*} [data] application specific data associated with the
	 *     connection
	 * @returns {number} the ID of the connection
	 */
	hub.connect = function(data) {
		var connectionID = nextID++;
		connections[connectionID] = connection.create(data, instantiate);
		return connectionID;
	};

	/**
	 * Disconnects a previously connected connection.
	 * @param {number} id the ID of the connection
	 * @return {} hub object
	 */
	hub.disconnect = function(id) {
		getConnection(id).disconnect();
		delete connections[id];
		return hub;
	};

	/**
	 * Handles a message received on a connection.
	 * @param {number} id the ID of the connection
	 * @param {object} message the received message
	 * @return {} hub object
	 */
	hub.receive = function(id, message) {
		getConnection(id).receive(message);
		return hub;
	};

	/**
	 * Requests pending messages being sent on the identified connection.
	 * @param {number} id the ID of the connection
	 * @returns {promise} a promise for messages being sent on the connection
	 */
	hub.request = function(id) {
		return getConnection(id).request();
	};

	/**
	 * Instantiates an object from the named factory, which was previously
	 * registered.
	 * @param {string} name the name of the previously registered factory from
	 *     which to instantiate the object
	 * @param {*} [context] the context in which the object should be
	 *     instantiated
	 * (this value or object will be passed to the factory function)
	 * @returns {*} the instantiated object
	 */
	function instantiate(name, context) {
		if (!factories[name]) {
			throw new Error('no such object factory: ' + name);
		}
		return factories[name](context);
	}

	/**
	 * Returns the connection object associated with the provided ID.
	 * @param {number} id the id of the connection to return
	 * @returns {connection} the identified connection
	 * @throws error if no such connection exists
	 */
	function getConnection(id) {
		if (connections[id]) {
			return connections[id];
		} else {
			throw new Error('no such connection: ' + id);
		}
	}

	// return the hub object
	return hub;
};
