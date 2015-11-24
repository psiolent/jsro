var expect = require('chai').expect;
var index = require('../index.js');

describe('index', function() {
	'use strict';

	it('has a create() function', function() {
		expect(index.create).to.be.a('Function');
	});
});
