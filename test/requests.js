'use strict';

var assert = require('assert');

var HELLOWORLD_PARAMS = {
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
};

exports.helloworld = function(client, done){
	client.on('ready', function(){
		client.request(HELLOWORLD_PARAMS, function(err, request){
			assert.ifError(err);
			request.stdout.on('data', function(data){
				var str = data.toString('utf8');
				var body = str.split('\r\n\r\n', 2)[1];
				assert.equal(body, 'Hello world!');
			});
			request.stderr.on('data', function(data){
			});
			request.stdout.on('end', function(){
				assert.equal(request.getExitStatus(), 0);
				done();
			});
			request.stdin.end();
		});
	});
};

exports.helloworldBatch = function(times, client, done){
	client.on('ready', function(){
		var waitDone = times;
		while(times--) {
			client.request(HELLOWORLD_PARAMS, function(err, request){
				assert.ifError(err);
				request.stdout.on('data', function(data){
					var str = data.toString('utf8');
					var body = str.split('\r\n\r\n', 2)[1];
					assert.equal(body, 'Hello world!');
				});
				request.stderr.on('data', function(data){
				});
				request.stdout.on('end', function(){
					assert.equal(request.getExitStatus(), 0);
					if(!--waitDone) done();
				});
				request.stdin.end();
			});
		}
	});
};

exports.helloworldBatchWithDelay = function(times, delay, client, done){
	client.on('ready', function(){
		var waitDone = times;
		for(var i=0; i<times; i++) {
			setTimeout(function(){
				client.request(HELLOWORLD_PARAMS, function(err, request){
					assert.ifError(err);
					request.stdout.on('data', function(data){
						var str = data.toString('utf8');
						var body = str.split('\r\n\r\n', 2)[1];
						assert.equal(body, 'Hello world!');
					});
					request.stderr.on('data', function(data){
					});
					request.stdout.on('end', function(){
						assert.equal(request.getExitStatus(), 0);
						if(!--waitDone) done();
					});
					request.stdin.end();
				});
			}, delay * i);
		}
	});
};

exports.helloworldBatchSeries = function(times, client, done){
	client.on('ready', function(){
		var next = function(){
			if(!times) return done();
			times--;
			client.request(HELLOWORLD_PARAMS, function(err, request){
				assert.ifError(err);
				request.stdout.on('data', function(data){
					var str = data.toString('utf8');
					var body = str.split('\r\n\r\n', 2)[1];
					assert.equal(body, 'Hello world!');
				});
				request.stderr.on('data', function(data){
				});
				request.stdout.on('end', function(){
					assert.equal(request.getExitStatus(), 0);
					next();
				});
				request.stdin.end();
			});
		};
		next();
	});
};
