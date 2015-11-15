'use strict';

var stream = require('stream');

var MSG_TYPE = require('./consts').MSG_TYPE;
var createConnection = require('./connection');

module.exports = function(client){
	var multiConnMode = client._mpxsConns;
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
		var cbCalled = false;
		if(multiConnMode) {
			curConcurrent++;
			var conn = createConnection(client);
			conn.on('error', function(err){
				if(cbCalled) return;
				cb(err);
			});
			conn.on('connect', function(){
				cb(null, conn, 1, {
					// TODO
				});
			});
		} else {
			// TODO
		}
	};

	return function(params, cb){
		allocReq(function(err, conn, reqId, handlers){
			if(err) {
				curConcurrent--;
				cb(err);
				return;
			}

			var stdin = stream.createWriteStream({
				write: function(chunk, cb){
					conn.send(MSG_TYPE.FCGI_STDIN, reqId, chunk);
					cb();
				}
			});
			var stdout = stream.createReadStream({
				read: function(n){}
			});
			var stderr = stream.createReadStream({
				read: function(n){}
			});

			handlers.stdout = function(data){
				stdout.push(data);
			};
			handlers.stderr = function(data){
				stderr.push(data);
			};
			handlers.end = function(data){
				stdout.push(null);
				stderr.push(null);
			};

			cb(null, {
				abort: function(){
					conn.send(MSG_TYPE.FCGI_ABORT_REQUEST, reqId, new Buffer(0));
				},
				stdout: stdin,
				stdout: stdout,
				stderr: stderr,
			});
		});
	};
};
