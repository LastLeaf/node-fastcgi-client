'use strict';

var stream = require('stream');

var MSG_TYPE = require('./consts').MSG_TYPE;
var PROTOCOL_STATUS = require('./consts').PROTOCOL_STATUS;
var createConnection = require('./connection');

var BEGIN_REQUEST_DATA_NO_KEEP_CONN = new Buffer('\0\x01\0\0\0\0\0\0'); // FCGI_ROLE_RESPONDER && !FCGI_KEEP_CONN
var BEGIN_REQUEST_DATA_KEEP_CONN = new Buffer('\0\x01\x01\0\0\0\0\0'); // FCGI_ROLE_RESPONDER && FCGI_KEEP_CONN

module.exports = function(client){
	var multiConnMode = !client._mpxsConns;
	var maxConcurrent = multiConnMode ? client._maxConns : client._maxReqs;
	var curConcurrent = 0;

	// multi conn mode
	var allocReq = null;
	if(multiConnMode) {
		// build connection for each request
		allocReq = function(cb){
			if(curConcurrent >= maxConcurrent) {
				setImmediate(function(){
					cb(new Error('Requests reached maximum allowed concurrency limit.'));
				});
				return;
			}
			curConcurrent++;
			var conn = createConnection(client);
			var cbCalled = false;
			var endData = null;
			var handlers = {
				stdout: function(){},
				stderr: function(){},
				end: function(){},
			};
			conn.on('error', function(err){
				if(cbCalled) return;
				cb(err);
			});
			conn.on('close', function(){
				curConcurrent--;
				if(cbCalled) {
					handlers.end(endData);
				}
			});
			conn.on('message-' + MSG_TYPE.FCGI_STDOUT, function(reqId, data){
				handlers.stdout(data);
			});
			conn.on('message-' + MSG_TYPE.FCGI_STDERR, function(reqId, data){
				handlers.stderr(data);
			});
			conn.on('message-' + MSG_TYPE.FCGI_END_REQUEST, function(reqId, data){
				endData = data;
			});
			conn.on('connect', function(){
				cbCalled = true;
				cb(null, conn, 1, handlers);
			});
		};
	} else {
		// connection manager for non-multiConnMode
		var handlers = new Array(maxConcurrent);
		var waitNextConnect = [];
		var nextReqId = 1;
		var conn = null;
		var newConn = function(){
			var connection = createConnection(client);
			connection.on('connect', function(){
				conn = connection;
				nextReqId = 1;
				var funcs = waitNextConnect;
				waitNextConnect = [];
				for(var i=0; i<funcs.length; i++) {
					funcs[i]();
				}
			});
			connection.on('error', function(err){
				client.emit('error', err);
			});
			connection.on('close', function(){
				var endFuncs = [];
				if(curConcurrent) {
					for(var i=0; i<handlers.length; i++) {
						if(handlers[i]) {
							endFuncs.push(handlers[i].end);
							handlers[i] = null;
						}
					}
					curConcurrent = 0;
				}
				conn = null;
				newConn();
				for(var i=0; i<endFuncs.length; i++) {
					endFuncs[i]();
				}
			});
			connection.on('message-' + MSG_TYPE.FCGI_STDOUT, function(reqId, data){
				console.info(arguments);
				handlers[reqId].stdout(data);
			});
			connection.on('message-' + MSG_TYPE.FCGI_STDERR, function(reqId, data){
				handlers[reqId].stderr(data);
			});
			connection.on('message-' + MSG_TYPE.FCGI_END_REQUEST, function(reqId, data){
				console.info(arguments);
				curConcurrent--;
				var endFunc = handlers[reqId].end;
				handlers[reqId] = null;
				if(nextReqId >= 65536) conn.end();
				endFunc(data);
			});
		};
		newConn();
		allocReq = function(cb){
			// use current connection
			if(curConcurrent >= maxConcurrent) {
				setImmediate(function(){
					cb(new Error('Requests reached maximum allowed concurrency limit.'));
				});
				return;
			}
			curConcurrent++;
			var handlers = {
				stdout: function(){},
				stderr: function(){},
				end: function(){},
			};
			if(nextReqId < 65536 && conn) {
				var reqId = nextReqId++;
				handlers[reqId] = handlers;
				setImmediate(function(){
					cb(null, conn, reqId, handlers);
				});
			}
			waitNextConnect.push(function(){
				var reqId = nextReqId++;
				handlers[reqId] = handlers;
				cb(null, conn, reqId, handlers);
			});
		};
	}

	return function(params, cb){
		allocReq(function(err, conn, reqId, handlers){
			if(err) {
				cb(err);
				return;
			}

			var exitStatus = null;

			var stdin = new stream.Writable({
				write: function(chunk, encoding, cb){
					conn.send(MSG_TYPE.FCGI_STDIN, reqId, chunk, cb);
				}
			});
			stdin.on('finish', function(){
				conn.send(MSG_TYPE.FCGI_STDIN, reqId, null);
			});
			var stdout = new stream.Readable({
				read: function(n){}
			});
			var stderr = new stream.Readable({
				read: function(n){}
			});

			handlers.stdout = function(data){
				stdout.push(data);
			};
			handlers.stderr = function(data){
				stderr.push(data);
			};
			handlers.end = function(data){
				if(data) {
					var exitCode = data.readInt32BE(0, true);
					var protocolStatus = data.readUInt8(4, true);
					if(protocolStatus === PROTOCOL_STATUS.FCGI_CANT_MPX_CONN) {
						exitStatus = new Error('Server rejected request: exceeds maximum number of concurrent requests.');
					} else if(protocolStatus === PROTOCOL_STATUS.FCGI_OVERLOADED) {
						exitStatus = new Error('Server rejected request: resource not available.');
					} else if(protocolStatus === PROTOCOL_STATUS.FCGI_UNKNOWN_ROLE) {
						exitStatus = new Error('Server rejected request: FastCGI role not supported.');
					} else {
						exitStatus = exitCode;
					}
				} else {
					exitStatus = new Error('Request unexpectedly ended.');
				}
				stdout.push(null);
				stderr.push(null);
			};

			if(multiConnMode) conn.send(MSG_TYPE.FCGI_BEGIN_REQUEST, reqId, BEGIN_REQUEST_DATA_NO_KEEP_CONN);
			else conn.send(MSG_TYPE.FCGI_BEGIN_REQUEST, reqId, BEGIN_REQUEST_DATA_KEEP_CONN);
			conn.send(MSG_TYPE.FCGI_PARAMS, reqId, params);
			conn.send(MSG_TYPE.FCGI_PARAMS, reqId, null);

			cb(null, {
				abort: function(){
					conn.send(MSG_TYPE.FCGI_ABORT_REQUEST, reqId, new Buffer(0));
				},
				stdin: stdin,
				stdout: stdout,
				stderr: stderr,
				getExitStatus: function(){
					return exitStatus;
				}
			});
		});
	};
};
