'use strict';

var cases = [];

var childProcess = require('child_process');
var assert = require('assert');

var phpProc = null;

describe('start php server and test connection', function(){
	before(function(done){
		phpProc = childProcess.spawn('php-cgi', ['php-cgi', '-b', '127.0.0.1:9900'], {stdio: 'ignore'});
		phpProc.on('error', function(err){
			assert.ifError(err);
		});
		setTimeout(done, 1000);
	});
	it('TODO', function(done){
		done();
	});
	after(function(done){
		phpProc.kill();
		done();
	});
});

cases.forEach(function(file){
	require('./cases/' + file + '.js');
});

describe('kill php server', function(){
	after(function(done){
		phpProc.kill();
		done();
	});
});
