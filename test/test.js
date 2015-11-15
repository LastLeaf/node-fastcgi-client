'use strict';

var cases = [];

var childProcess = require('child_process');
var assert = require('assert');

var fcgiClient = require('../index');

var phpProc = null;

describe('Try connect to 127.0.0.1:9000 as FastCGI server', function(){
	/*before(function(done){
		phpProc = childProcess.spawn('php-cgi', ['-b', '127.0.0.1:9900'], {stdio: 'ignore'});
		phpProc.on('error', function(err){
			assert.ifError(err);
		});
		setTimeout(done, 1000);
	});*/
	it('Connect and disconnect', function(done){
		var client = fcgiClient({
			host: '127.0.0.1',
			port: 9000
		});
		client.on('ready', done);
	});
	/*after(function(done){
		phpProc.kill();
		done();
	});*/
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
