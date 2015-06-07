module.exports = function(grunt) {
	'use strict';

	grunt.initConfig({
		jshint: {
			files: ['*.js'],
			options: {
				jshintrc: true
			}
		},
		simplemocha: {
			all: {
				src: ['tests/*.js']
			}
		}
	});

	grunt.loadNpmTasks('grunt-contrib-jshint');
	grunt.loadNpmTasks('grunt-simple-mocha');

	grunt.registerTask('test', ['jshint', 'simplemocha']);
	grunt.registerTask('default', ['jshint', 'simplemocha']);
};
