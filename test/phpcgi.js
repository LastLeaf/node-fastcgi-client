'use strict';

var childProcess = require('child_process');
var assert = require('assert');

var fcgiClient = require('../index');
var requests = require('./requests');

describe('Open a PHP-CGI process as FastCGI server', function(){
	var phpProc = null;

	before(function(done){
		phpProc = childProcess.spawn('php-cgi', ['-b', '127.0.0.1:9900'], {stdio: 'ignore'});
		phpProc.on('error', function(err){
			assert.ifError(err);
		});
		setTimeout(done, 1000);
	});

	var connectOptions = {
		host: '127.0.0.1',
		port: 9900,
		mpxsConns: 1,
		skipCheckServer: true
	};

	it('Connect and disconnect', function(done){
		var client = fcgiClient(connectOptions);
		client.on('ready', done);
	});

	it('Execute PHP helloworld', function(done){
		var client = fcgiClient(connectOptions);
		requests.helloworld(client, done);
	});

	it('Execute PHP helloworld * 100', function(done){
		this.timeout(10000);
		var client = fcgiClient(connectOptions);
		requests.helloworldBatch(100, client, done);
	});

	it('Execute PHP helloworld * 100 (With Delay)', function(done){
		this.timeout(10000);
		var client = fcgiClient(connectOptions);
		requests.helloworldBatchWithDelay(100, 1, client, done);
	});

	it('Execute PHP helloworld * 100 (Series)', function(done){
		this.timeout(10000);
		var client = fcgiClient(connectOptions);
		requests.helloworldBatchSeries(100, client, done);
	});

	after(function(done){
		phpProc.kill();
		done();
	});
});
