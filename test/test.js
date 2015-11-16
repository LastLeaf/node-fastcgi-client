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

	it('Execute PHP helloworld', function(done){
		var client = fcgiClient({
			host: '127.0.0.1',
			port: 9000
		});
		client.on('ready', function(){
			client.request({
				QUERY_STRING: '',
				REQUEST_METHOD: 'GET',
				CONTENT_TYPE: '',
				CONTENT_LENGTH: '',
				SCRIPT_FILENAME: __dirname + '/www/helloworld.php',
				SCRIPT_NAME: '/helloworld.php',
				REQUEST_URI: '/helloworld.php',
				DOCUMENT_URI: '/helloworld.php',
				DOCUMENT_ROOT: '/tmp',
				SERVER_PROTOCOL: 'HTTP/1.1',
				GATEWAY_INTERFACE: 'CGI/1.1',
				REMOTE_ADDR: '127.0.0.1',
				REMOTE_PORT: 12345,
				SERVER_ADDR: '127.0.0.1',
				SERVER_PORT: 80,
				SERVER_NAME: '127.0.0.1',
				REDIRECT_STATUS: 200,
			}, function(err, request){
				assert.ifError(err);
				request.stdout.on('data', function(data){
					console.info(data.toString('utf8'));
				});
				request.stderr.on('data', function(data){
					console.info(data.toString('utf8'));
				});
				request.stdout.on('end', function(){
					console.info(request.getExitStatus());
					done();
				});
				request.stdin.end();
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
