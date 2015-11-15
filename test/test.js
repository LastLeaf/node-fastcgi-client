'use strict';

var cases = [];

var childProcess = require('child_process');
var assert = require('assert');

var fcgiClient = require('../index');

var phpProc = null;

describe('Connect to 127.0.0.1:9000 as FastCGI server', function(){
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

	it('Send empty request.', function(done){
		var client = fcgiClient({
			host: '127.0.0.1',
			port: 9000
		});
		client.on('ready', function(){
			client.request({
				QUERY_STRING: '/',
				REQUEST_METHOD: 'GET',
				CONTENT_TYPE: 'text/plain',
				CONTENT_LENGTH: 0,
				SCRIPT_FILENAME: '/tmp/a.php',
				SCRIPT_NAME: 'a.php',
				REQUEST_URI: '/tmp/a.php',
				DOCUMENT_URI: '/tmp/a.php',
				DOCUMENT_ROOT: '/tmp',
				SERVER_PROTOCOL: 'HTTP/1.1',
				GATEWAY_INTERFACE: 'CGI/1.1',
				REDIRECT_STATUS: 200,
			}, function(err, request){
				assert.ifError(err);
				request.stdout.on('data', function(data){
					console.info(data);
				});
				request.stderr.on('data', function(data){
					console.info(data);
				});
				request.stdout.on('end', function(){
					console.info(request.getExitStatus());
					done();
				});
				request.stdin.end(new Buffer(0));
			});
		});
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
