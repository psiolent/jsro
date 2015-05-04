var expect = require('chai').expect;
var index = require('../index.js');

describe('index', function() {
	"use strict";

	it('should have "hello" for the hello property', function() {
		expect(index.hello).to.equal('hello');
	});
});
