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
				return;
			});
			conn.on('close', function(){
				curConcurrent--;
				if(cbCalled) {
					handlers.end(endData);
				} else {
					cb(new Error('Cannot send request to server.'));
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
		var nextReqId = 0;
		var conn = null;
		var newConn = function(){
			conn = createConnection(client);
			conn.on('connect', function(){
				nextReqId = 1;
				var funcs = waitNextConnect;
				waitNextConnect = [];
				for(var i=0; i<funcs.length; i++) {
					funcs[i]();
				}
			});
			conn.on('error', function(err){
				if(nextReqId) {
					nextReqId = 0;
				} else if(waitNextConnect.length) {
					// connecting error again with requests in queue
					for(var i=0; i < waitNextConnect.length; i++) {
						waitNextConnect[i](new Error('Cannot send request to server.'));
					}
					waitNextConnect = [];
				}
			});
			conn.on('close', function(){
				var endFuncs = [];
				if(curConcurrent) {
					// clear reqs with req ids
					for(var i=0; i<handlers.length; i++) {
						if(handlers[i]) {
							endFuncs.push(handlers[i].end);
							handlers[i] = null;
							curConcurrent--;
						}
					}
				}
				conn = null;
				nextReqId = 0;
				if(waitNextConnect.length) {
					newConn();
				}
				for(var i=0; i<endFuncs.length; i++) {
					endFuncs[i]();
				}
			});
			conn.on('message-' + MSG_TYPE.FCGI_STDOUT, function(reqId, data){
				handlers[reqId].stdout(data);
			});
			conn.on('message-' + MSG_TYPE.FCGI_STDERR, function(reqId, data){
				handlers[reqId].stderr(data);
			});
			conn.on('message-' + MSG_TYPE.FCGI_END_REQUEST, function(reqId, data){
				curConcurrent--;
				var endFunc = handlers[reqId].end;
				handlers[reqId] = null;
				// check whether connection is needed to be rebuilt
				if(!curConcurrent) {
					nextReqId = 0;
					conn.end();
				} else if(nextReqId >= 65536) {
					conn.end();
				}
				endFunc(data);
			});
		};
		allocReq = function(cb){
			// use current connection
			if(curConcurrent >= maxConcurrent) {
				setImmediate(function(){
					cb(new Error('Requests reached maximum allowed concurrency limit.'));
				});
				return;
			}
			curConcurrent++;
			var funcs = {
				stdout: function(){},
				stderr: function(){},
				end: function(){},
			};
			if(nextReqId && nextReqId < 65536) {
				// alloc a new req id
				var reqId = nextReqId++;
				handlers[reqId] = funcs;
				setImmediate(function(){
					cb(null, conn, reqId, funcs);
				});
				return;
			}
			waitNextConnect.push(function(err){
				// wait connection to be available
				if(err) {
					cb(err);
					return;
				}
				var reqId = nextReqId++;
				handlers[reqId] = funcs;
				cb(null, conn, reqId, funcs);
			});
			if(!conn) newConn();
		};
	}

	return function(params, cb){
		allocReq(function(err, conn, reqId, handlers){
			if(err) {
				cb(err);
				return;
			}

			var exitStatus = null;

			var stdin = new stream.Writable();
			stdin._write = function(chunk, encoding, cb){
				conn.send(MSG_TYPE.FCGI_STDIN, reqId, chunk, cb);
			};
			stdin.on('finish', function(){
				conn.send(MSG_TYPE.FCGI_STDIN, reqId, null);
			});
			var stdout = new stream.Readable();
			stdout._read = function(n){};
			var stderr = new stream.Readable();
			stderr._read = function(n){};

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

			// TODO add force end method to let server run with single req
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
