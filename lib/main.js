'use strict';

var EventEmitter = require('events').EventEmitter;

var checkServer = require('./check');
var createRequestManager = require('./request');

module.exports = function(options){
	options = options || {};

	var client = new EventEmitter();
	client._host = options.host || '127.0.0.1';
	client._port = options.port || 9000;
	client._sockFile = options.sockFile || '';

	// server options
	client._maxConns = options.maxConns <= 65535 ? options.maxConns : 65535;
	client._maxReqs = options.maxReqs <= 65535 ? options.maxConns : 65535;
	client._mpxsConns = !!options.mpxsConns;
	var sendReady = function(){
		client.request = createRequestManager(client);
		client.emit('ready');
	};
	if(!options.skipCheckServer) checkServer(client, sendReady);
	else setImmediate(sendReady);

	return client;
};
