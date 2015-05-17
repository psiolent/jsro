/**
 * Creates a queue for messages intended to be sent to the client.
 */
module.exports.create = function() {
	'use strict';

	// create the queue object
	var queue = {};

	// first and last items in linked list
	var first = null;
	var last = null;

	// the next ID to assign to an enqueued message
	var nextID = 0;

	/**
	 * Adds the provided message to the queue.
	 * @param {*} message the message to add to the queue
	 */
	queue.enqueue = function(message) {
		// create the list item for this message
		var item = {
			id: nextID++,
			next: null,
			message: message
		};

		// add it to list
		if (first === null) {
			first = last = item;
		} else {
			last.next = item;
			last = item;
		}
	};

	/**
	 * Clears all messages from the queue up to and including the identified
	 * message.
	 * @param {number} id the id of the last message to clear from the queue
	 */
	queue.clear = function(id) {
		var clearThrough = first;
		while (clearThrough !== null && clearThrough.id !== id) {
			clearThrough = clearThrough.next;
		}
		if (clearThrough !== null) {
			// we found the item to clear through
			first = clearThrough.next;
			if (first === null) {
				last = null;
			}
		}
	};

	/**
	 * Converts the queue to an array of objects. Each object in the array will
	 * have an 'id' property and a 'message' property.
	 */
	queue.toArray = function() {
		// create the array to hold the list
		var a = [];

		// add each item to the list
		var item = first;
		while (item !== null) {
			a.push({
				id: item.id,
				message: item.message
			});
			item = item.next;
		}

		return a;
	};

	// return the queue object
	return queue;
};
