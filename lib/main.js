'use strict';

var EventEmitter = require('events');

var createConnection = require('./connection');

module.exports = function(options){
	options = options || {};

	var eventEmitter = new EventEmitter();
	var connection = createConnection(client, options);
	client.disconnect = connection.disconnect;
	client.request = require('./request')(client, options);

	connection.connect();
	return client;
};
