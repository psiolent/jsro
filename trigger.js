/**
 * Creates a new trigger. A trigger manages the firing of events and the
 * listeners listening to those events.
 */
module.exports.create = function() {
	'use strict';

	// create the trigger object
	var trigger = {};

	// listeners registered for different events
	var listeners = {};

	/**
	 * Registers a listener for a type of event.
	 * @param {string} event the event type
	 * @param {Function} fn the function to invoke to handle the event
	 */
	trigger.on = function(event, fn) {
		if (typeof event !== 'string') {
			throw new Error('"event" not a string');
		}
		if (!(fn instanceof Function)) {
			throw new Error('"fn" not a Function');
		}

		if (!listeners[event]) {
			listeners[event] = [];
		}
		listeners[event].push(fn);
	};

	/**
	 * Unregisters one or all listeners for an event.
	 * @param event the event to unregister for
	 * @param [fn] if provided, the listener function to unregister; if not
	 * provided, all listeners will be unregistered
	 */
	trigger.off = function(event, fn) {
		if (typeof event !== 'string') {
			throw new Error('"event" not a string');
		}
		if (fn !== undefined && !(fn instanceof Function)) {
			throw new Error('"fn" not a Function');
		}

		// do we have any listeners for this event?
		if (!listeners[event]) {
			return;
		}

		if (fn) {
			// unregistering a specific listener for the event
			listeners[event] = listeners[event].filter(function(l) {
				return l !== fn;
			});
			if (listeners[event].length === 0) {
				listeners[event] = undefined;
			}
		} else {
			// unregistering all listeners for the event
			listeners[event] = undefined;
		}
	};

	/**
	 * Fires an event.
	 * @param {string} event the event to fire
	 * @param {...*} arguments to pass to the event handlers
	 * @returns {Object} this trigger
	 */
	trigger.fire = function(event) {
		if (typeof event !== 'string') {
			throw new Error('"event" not a string');
		}

		// any listeners registered?
		if (!listeners[event]) {
			return trigger;
		}

		// get optional arguments
		var args = Array.prototype.slice.call(arguments, 1);

		// invoke listener functions
		listeners[event].slice(0).forEach(function(fn) {
			fn.apply(global, args);
		});

		return trigger;
	};

	// return the trigger object
	return trigger;
};
