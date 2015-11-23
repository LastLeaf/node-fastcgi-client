'use strict';

var net = require('net');

var MSG_TYPE = require('./consts').MSG_TYPE;
var createConnection = require('./connection');
var parsekv = require('./parsekv');

module.exports = function(client, cb){
	var conn = createConnection(client);

	var received = false;
	conn.on('message-' + MSG_TYPE.FCGI_GET_VALUES_RESULT, function(reqId, data){
		var kv = null;
		try {
			kv = parsekv(data);
			kv.FCGI_MAX_CONNS = Number(kv.FCGI_MAX_CONNS);
			kv.FCGI_MAX_REQS = Number(kv.FCGI_MAX_REQS);
			kv.FCGI_MPXS_CONNS = Number(kv.FCGI_MPXS_CONNS);
			if(kv.FCGI_MAX_CONNS >= 0 && kv.FCGI_MAX_CONNS < client._maxConns) {
				client._maxConns = kv.FCGI_MAX_CONNS;
			}
			if(kv.FCGI_MAX_REQS >= 0 && kv.FCGI_MAX_REQS < client._maxReqs) {
				client._maxReqs = kv.FCGI_MAX_REQS;
			}
			if(kv.FCGI_MPXS_CONNS > 0) {
				client._mpxsConns = true;
			} else {
				client._mpxsConns = false;
			}
		} catch(e) {
			client.emit('error', e);
		}
		received = true;
		conn.end();
		return;
	});

	conn.on('connect', function(){
		conn.send(MSG_TYPE.FCGI_GET_VALUES, 0, {
			FCGI_MAX_CONNS: '',
			FCGI_MAX_REQS: '',
			FCGI_MPXS_CONNS: '',
		});
	});
	conn.on('error', function(e){
		client.emit('error', e);
	});
	conn.on('close', function(){
		if(!received) {
			client.emit('error', new Error('Server did not respond its FastCGI options.'));
		}
		cb();
	});
};
