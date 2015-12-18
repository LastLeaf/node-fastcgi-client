'use strict';

var assert = require('assert');

var fcgiClient = require('../index');
var requests = require('./requests');

describe('Use 127.0.0.1:9000 as FastCGI server', function(){

	var connectOptions = {
		host: '127.0.0.1',
		port: 9000
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

	it('Execute PHP helloworld * 500', function(done){
		this.timeout(10000);
		var client = fcgiClient(connectOptions);
		requests.helloworldBatch(500, client, done);
	});

	it('Execute PHP helloworld * 500 (With Delay)', function(done){
		this.timeout(10000);
		var client = fcgiClient(connectOptions);
		requests.helloworldBatchWithDelay(500, 1, client, done);
	});

});
