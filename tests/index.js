var expect = require('chai').expect;
var index = require('../index.js');

describe('index', function() {
	'use strict';

	it('has a router() function', function() {
		expect(index.router).to.be.a('Function');
	});
});
