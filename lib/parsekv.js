'use strict';

var parsePair = function(msgData, start){
	if(msgData.length - start < 1) throw new Error('Unexpected server message: illegal key pair format.');
	var keyLen = msgData.readUInt8(start, true);
	if(keyLen > 127) {
		if(msgData.length - start < 4) throw new Error('Unexpected server message: illegal key pair format.');
		keyLen = (msgData.readInt32BE(start, true) & 0x7fffffff);
		start += 4;
	} else {
		start++;
	}
	if(msgData.length - start < 1) throw new Error('Unexpected server message: illegal key pair format.');
	var valueLen = msgData.readUInt8(start, true);
	if(valueLen > 127) {
		if(msgData.length - start < 4) throw new Error('Unexpected server message: illegal key pair format.');
		valueLen = (msgData.readInt32BE(start, true) & 0x7fffffff);
		start = start + 4;
	} else {
		start++;
	}
	if(msgData.length - start < keyLen + valueLen) throw new Error('Unexpected server message: illegal key pair format.');
	return {
		key: msgData.toString('utf8', start, start + keyLen),
		value: msgData.toString('utf8', start + keyLen, start + keyLen + valueLen),
		end: start + keyLen + valueLen
	};
};

module.exports = function(msgData){
	var res = {};
	for(var pos = 0; pos < msgData.length;) {
		var pair = parsePair(msgData, pos);
		res[pair.key] = pair.value;
		pos = pair.end;
	}
	return res;
};
