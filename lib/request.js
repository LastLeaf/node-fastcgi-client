'use strict';

module.exports = function(client, options){
	var reqQueueMax = options.maxQueue;
	var reqQueue = [];
	var rsQueue = 0;
	var reqCbMap = new Array(65535);

	client._checkQueue = function(){
		// TODO
	};

	client._response = function(){
		// TODO
	};

	return function(params, stdinStream, cb){
		// TODO
	};
};
