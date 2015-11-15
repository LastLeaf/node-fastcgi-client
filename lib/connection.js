'use strict';

var net = require('net');
var stream = require('stream');
var EventEmitter = require('events');

var MSG_TYPE = require('./consts').MSG_TYPE;
var PROTOCOL_STATUS = require('./consts').PROTOCOL_STATUS;
var stringifykv = require('./stringifykv');

var PADDING_BUFS = [
	new Buffer(0),
	new Buffer('\0'),
	new Buffer('\0\0'),
	new Buffer('\0\0\0'),
	new Buffer('\0\0\0\0'),
	new Buffer('\0\0\0\0\0'),
	new Buffer('\0\0\0\0\0\0'),
	new Buffer('\0\0\0\0\0\0\0'),
];

module.exports = function(client){
	// init connect
	var conn = new EventEmitter();
	var connected = false;

	// socket basis
	var socket = net.createConnection({port: client._port, host: client._host, timeout: client._connectionTimeout}, function(){
		socket.setKeepAlive();
		connected = true;
		conn.emit('connect');
	});
	socket.on('error', function(e){
		connected = false;
		conn.emit('error', e);
	});
	socket.on('close', function(){
		conn.emit('close');
	});
	conn.end = function(){
		socket.end();
	};

	// send message
	conn.send = function(msgType, reqId, obj){
		if(!connected) return;
		var data = obj;
		if(! (obj instanceof Buffer)) {
			// kv pairs
			data = stringifykv(obj);
		}
		// TODO split for length > 65535
		var contentLen = data.length;
		var paddingLen = (8 - (contentLen % 8)) % 8;
		var buf = new Buffer(8);
		buf.writeUInt8(1, 0, true);
		buf.writeUInt8(msgType, 1, true);
		buf.writeUInt16BE(reqId, 2, true);
		buf.writeUInt16BE(contentLen, 4, true);
		buf.writeUInt8(paddingLen, 6, true);
		buf.writeUInt8(0, 7, true);
		socket.write(buf);
		socket.write(data);
		if(paddingLen) socket.write(PADDING_BUFS[paddingLen]);
	};

	// receive message
	var reqId = 0;
	var msgType = -1;
	var bodyLen = 0;
	var contentLen = 0;
	socket.on('readable', function(){
		if(msgType === -1) {
			// read a new message header
			var headData = socket.read(8);
			if(headData === null) return;
			if(headData.readUInt8(0, true) !== 1) {
				conn.emit('error', new Error('The server does not speak a compatible FastCGI protocol.'));
				conn.end();
				return;
			}
			msgType = headData.readUInt8(1, true);
			reqId = headData.readUInt16BE(2, true);
			contentLen = headData.readUInt16BE(4, true);
			var paddingLen = headData.readUInt8(6, true);
			bodyLen = contentLen + paddingLen;
		} else if(msgType === MSG_TYPE.FCGI_GET_VALUES_RESULT || msgType === MSG_TYPE.FCGI_END_REQUEST) {
			// non-stream message
			var data = socket.read(bodyLen);
			if(data === null) return;
			var ev = 'message-' + msgType;
			msgType = -1;
			conn.emit(ev, reqId, data.slice(0, contentLen));
		/*} else if(msgType === MSG_TYPE.FCGI_END_REQUEST) {
			// end request message
			var data = socket.read(bodyLen);
			if(data === null) return;
			msgType = -1;
			var exitCode = data.readInt32BE(0, true);
			var protocolStatus = data.readUInt8(4, true);
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
			}*/
		} else if(msgType === MSG_TYPE.FCGI_STDERR || msgType === MSG_TYPE.FCGI_STDOUT) {
			// stream message
			// TODO consider use streams here
			var data = socket.read(bodyLen);
			if(data === null) return;
			var ev = 'message-' + msgType;
			msgType = -1;
			conn.emit(ev, reqId, data.slice(0, contentLen));
		}
	});

	return conn;
};
