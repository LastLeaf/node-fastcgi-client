'use strict';

var stream = require('stream');

var MSG_TYPE = require('./consts').MSG_TYPE;
var PROTOCOL_STATUS = require('./consts').PROTOCOL_STATUS;
var createConnection = require('./connection');

var BEGIN_REQUEST_DATA = new Buffer('\0\x01\x01\0\0\0\0\0'); // FCGI_ROLE_RESPONDER && FCGI_KEEP_CONN

module.exports = function(client){
	var multiConnMode = !client._mpxsConns;
	var maxConcurrent = multiConnMode ? client._maxConns : client._maxReqs;
	var curConcurrent = 0;
	var stdoutMap = new Array(maxConcurrent);
	var stderrMap = new Array(maxConcurrent);
	var endMap = new Array(maxConcurrent);

	var allocReq = function(cb){
		if(curConcurrent >= maxConcurrent) {
			setTimeout(function(){
				cb(new Error('Requests reached maximum allowed concurrency limit.'));
			}, 0);
			return;
		}
		if(multiConnMode) {
			curConcurrent++;
			var conn = createConnection(client);
			var cbCalled = false;
			var ended = false;
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
				if(cbCalled) {
					if(!ended) handlers.end();
					ended = true;
				}
				curConcurrent--;
			});
			conn.on('message-' + MSG_TYPE.FCGI_STDOUT, function(reqId, data){
				handlers.stdout(data);
			});
			conn.on('message-' + MSG_TYPE.FCGI_STDERR, function(reqId, data){
				handlers.stderr(data);
			});
			conn.on('message-' + MSG_TYPE.FCGI_END_REQUEST, function(reqId, data){
				if(!ended) handlers.end(data);
				ended = true;
				conn.end();
			});
			conn.on('connect', function(){
				cbCalled = true;
				cb(null, conn, 1, handlers);
			});
		} else {
			// TODO
		}
	};

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

			conn.send(MSG_TYPE.FCGI_BEGIN_REQUEST, reqId, BEGIN_REQUEST_DATA);
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
