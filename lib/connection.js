'use strict';

var net = require('net');
var stream = require('stream');

var MSG_TYPE = require('./consts').MSG_TYPE;
var PROTOCOL_STATUS = require('./consts').PROTOCOL_STATUS;
var parsekv = require('./parsekv');
var stringifykv = require('./stringifykv');
var genkv = require('./genkv');

module.exports = function(client, options){
	var conn = null;
	var state = 'initialized';

	var disconnect = function(){
		if(state === 'connected' || state === 'connecting') conn.end();
		state = 'disconnecting';
	};

	var connect = function(){
		if(state !== 'initialized') return;

		// connection management
		var onControlMsg = null;
		state = 'connecting';
		conn = net.createConnection(options.port, options.host, function(){
			// get server options
			onControlMsg = function(data){
				var kv = null;
				try {
					kv = parsekv(data);
				} catch(e) {
					client.emit('error', e);
					disconnect();
					return;
				}
				console.info(kv);
				onControlMsg = null;
				state = 'connected';
				client.emit('connect');
				//client._checkQueue();
			};
			sendMsg(0, MSG_TYPE.FCGI_GET_VALUES, {
				FCGI_MAX_CONNS: '',
				FCGI_MAX_REQS: '',
				FCGI_MPXS_CONNS: ''
			});
		});
		conn.on('close', function(){
			state = 'disconnected';
			client.emit('disconnect');
		});

		// send message
		var sendMsg = function(reqId, msgType, obj){
			var data = obj;
			if(typeof(obj) === 'object') {
				// kv pairs
				data = stringifykv(obj);
			}
			var buf = new Buffer(8);
			buf.writeUint8(1, 0, true);
			buf.writeUint8(msgType, 1, true);
			buf.writeUint16BE(reqId, 2, true);
			buf.writeUint16BE(contentLen, 4, true);
			buf.writeUint8(paddingLen, 6, true);
			buf.writeUint8(0, 7, true);
			conn.write(buf);
			conn.write(data);
		};

		// receive message
		var reqId = 0;
		var msgType = -1;
		var bodyLen = 0;
		conn.on('readable', function(){
			if(msgType === -1) {
				// read a new message header
				var headData = conn.read(8);
				if(headData === null) return;
				if(headData.readUInt8(0, true) !== 1) {
					client.emit('error', new Error('The server does not speak a compatible FastCGI protocol.'));
					disconnect();
					return;
				}
				msgType = headData.readUInt8(1, true);
				reqId = headData.readUInt16BE(2, true);
				var contentLen = headData.readUInt16BE(4, true);
				var paddingLen = headData.readUInt8(6, true);
				bodyLen = contentLen + paddingLen;
			} else if(msgType === MSG_TYPE.FCGI_GET_VALUES_RESULT) {
				// control message
				var data = conn.read(bodyLen);
				if(data === null) return;
				msgType = -1;
				if(onControlMsg) onControlMsg(data);
			} else if(msgType === MSG_TYPE.FCGI_END_REQUEST) {
				// end request message
				var data = conn.read(bodyLen);
				if(data === null) return;
				msgType = -1;
				exitCode = data.readInt32BE(0, true);
				protocolStatus = data.readUint8(4, true);
				if(protocolStatus === PROTOCOL_STATUS.FCGI_REQUEST_COMPLETE) {
					// client._endRequest(reqId);
				} else {
					if(protocolStatus === PROTOCOL_STATUS.FCGI_CANT_MPX_CONN) {
						client.emit('error', new Error('Server rejected request: exceeds maximum number of concurrent requests.'));
					} else if(protocolStatus === PROTOCOL_STATUS.FCGI_OVERLOADED) {
						client.emit('error', new Error('Server rejected request: resource not available.'));
					} else if(protocolStatus === PROTOCOL_STATUS.FCGI_UNKNOWN_ROLE) {
						client.emit('error', new Error('Server rejected request: FastCGI role not supported.'));
					}
					// client._abortRequest(reqId);
				}
			} else if(msgType === MSG_TYPE.FCGI_STDERR) {
				// push data to stderr stream
				var data = conn.read(bodyLen);
				if(data === null) return;
				msgType = -1;
				// client._stderrStreams[reqId].push(data);
			} else if(msgType === MSG_TYPE.FCGI_STDOUT) {
				// push data to stdout stream
				// client._stdoutStreams[reqId].push(data);
			}
		});
	};

	return {
		connect: connect,
		disconnect: disconnect,
	};
};
