module.exports.router = function() {
	'use strict';

	// create the router
	var router = require('express').Router();

	// create a json body parser
	var jsonParser = require('body-parser').json();

	// create a hub
	var hub = require('hub').create();

	// controller objects for controlling our connections, indexed by
	// connection ID
	var controllers = {};

	// default connection data property
	var dataProperty = 'jsroData';

	// default connection session property
	var sessionProperty = 'jsroSession';

	// default inactivity timeout (30 seconds)
	var inactivityTimeout = 30000;

	// handle connection ID parameter
	router.param('connectionID', function(req, res, next, connectionID) {
		req.jsroConnection = controllers[connectionID];
		var session = req[sessionProperty];
		if (!req.jsroConnection || !req.jsroConnection.isValid(session)) {
			res.status(404).send('No such connection');
		}
	});

	// handle ack ID parameter
	router.param('ackID', /^\d+$/);

	// get'ing the route's root establishes a new connection
	router.get('/', function(req, res) {
		// grab data and session for this connection, if any
		var data = dataProperty ? req[dataProperty] : undefined;
		var session = sessionProperty ? req[sessionProperty] : undefined;

		// create a connection and respond with the new connection ID
		res.json({connectionID: connect(data, session)});
	});

	// delete'ing a connection ID disconnects the connection
	router.delete('/:connectionID', function(req, res) {
		req.jsroConnection.disconnect();
		res.sendStatus(200);
	});

	// post'ing to a connection ID causes the connection to receive the message
	// (or messages) in the body of the post
	router.post('/:connectionID', jsonParser, function(req, res) {
		var messages = req.body;
		if (!(messages instanceof Array)) {
			messages = [messages];
		}
		messages.forEach(function(m) {
			req.jsroConnection.receive(m);
		});
		res.sendStatus(200);
	});

	// get'ing a connection ID performs a long poll for messages from the
	// connection
	router.get('/:connectionID/:ackID?', function(req, res, next) {
		req.jsroConnection.request().then(function(messages) {
			res.json(messages);
		}).catch(function(error) {
			if (error === 'abandoned') {
				// we're making up a status code here because none of the ones
				// previously defined seem to fit this use case
				// 438 - Abandoned
				// The request has been abandoned because it has been
				// superseded by another request.
				res.status(438).send('Abandoned');
			} else if (error === 'disconnected') {
				// we're making up a status code here because none of the ones
				// previously defined seem to fit this use case
				// 439 - Disconnected
				// The request has been rejected because the requesting client
				// has disconnected before the request could be fulfilled.
				res.status(439).send('Abandoned');
			} else {
				// something else, pass it on
				next(error);
			}
		});
	});

	/**
	 * Creates a new connection.
	 * @param data connection specific data
	 * @param session connection session info
	 * @returns {number} the new connection ID
	 */
	function connect(data, session) {
		// create the connection
		var connectionID = hub.connect(data);

		// create an interface for controlling our connection
		var controller = {};

		// a timeout object for scheduled inactivity timeouts
		var timeoutObject;

		/**
		 * Validates session info provided in a request.
		 * @param requestSession the session info provided in the request
		 * @returns {boolean} true if the session info is valid, false if not
		 */
		controller.isValid = function(requestSession) {
			return (!session && session !== requestSession);
		};

		/**
		 * Disconnects the connection.
		 */
		controller.disconnect = function() {
			clearTimeout(timeoutObject);
			hub.disconnect(connectionID);
			delete controllers[connectionID];
		};

		/**
		 * Causes the connection to receive the provided message.
		 * @param message the message for the connection to receive
		 */
		controller.receive = function(message) {
			restartTimeout();
			hub.receive(connectionID, message);
		};

		/**
		 * Performs a request on the connection.
		 *
		 * @returns {promise} a promise for messages to send to the client
		 */
		controller.request = function(ackID) {
			restartTimeout();
			return hub.request(connectionID, ackID);
		};

		/**
		 * Starts (or restarts) the inactivity timeout for this connection.
		 */
		function restartTimeout() {
			if (timeoutObject) {
				clearTimeout(timeoutObject);
			}
			setTimeout(controller.disconnect, inactivityTimeout);
		}

		// index the controller
		controllers[connectionID] = controller;

		// start our inactivity timeout
		restartTimeout();

		// and return the new connection ID
		return connectionID;
	}

	/**
	 * Gets or sets the connection data property name. When a new connection is
	 * requested, this router will look for a property with this name on the
	 * request object. If one is found, it will use its value as connection
	 * specific data which will in turn be provided to factory functions
	 * invoked to create instances for the connection. The default value is
	 * 'jsroData'. If set to undefined, no attempt will be made to read
	 * connection data from the request object.
	 * @param [property] if provided, sets the value of the data property;
	 * otherwise returns the current value of the data property
	 * @returns {*} the current data property for gets, and this router for sets
	 */
	router.dataProperty = function(property) {
		if (arguments.length === 0) {
			// getter
			return dataProperty;
		} else {
			// setter
			if (property !== undefined && typeof property !== 'string') {
				throw new Error('invalid argument type; expected string');
			}
			dataProperty = property;
			return router;
		}
	};

	/**
	 * Gets or sets the connection session property name. When a new connection
	 * is requested, this router will look for a property with this name on the
	 * request object. If one is found, it will store its value as a session
	 * identifier. For subsequent requests to the connection, this identifier
	 * will be re-read from the request object and compared to the initial
	 * value. If the values are not equivalent, the request will be rejected.
	 * The default value is 'jsroSession'. If set to undefined, no attempt will
	 * be made to read the session ID or to validate connection requests based
	 * on the ID.
	 * @param [property] if provided, sets the value of the session
	 * property; otherwise returns the current value of the session property
	 * @returns {*} the current session property for gets, and this router for
	 * sets
	 */
	router.sessionProperty = function(property) {
		if (arguments.length === 0) {
			// getter
			return sessionProperty;
		} else {
			// setter
			if (property !== undefined && typeof property !== 'string') {
				throw new Error('invalid argument type; expected string');
			}
			sessionProperty = property;
			return router;
		}
	};

	/**
	 * Gets or sets the connection inactivity timeout in milliseconds. If a
	 * connection does not see any activity for this timeout period, the
	 * connection will be disconnected and subsequent requests to the connection
	 * will be rejected.
	 * @param [timeout] if provided, sets the value of the inactivity
	 * timeout; otherwise returns the current value of the inactivity timeout
	 * @returns {*} the current inactivity timeouts for gets, and this router
	 * for sets
	 */
	router.inactivityTimeout = function(timeout) {
		if (arguments.length === 0) {
			// getter
			return inactivityTimeout;
		} else {
			// setter
			if (typeof timeout !== 'number') {
				throw new Error('invalid argument type; expected string');
			}
			if (timeout <= 0) {
				throw new Error('invalid argument; expected positive number');
			}
			inactivityTimeout = timeout;
			return router;
		}
	};

	// return the new router
	return router;
};
