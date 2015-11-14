'use strict';

var stringifyPair = function(key, value){
	value = String(value);
	var bufKey = new Buffer(key);
	var bufValue = new Buffer(value);
	var bufHead = null;
	var keyLen = bufKey.length;
	var valueLen = bufValue.length;
	if(keyLen > 127 && valueLen > 127) {
		bufHead = new Buffer(8);
		headData.readUInt32BE(keyLen, 0, true);
		headData.readUInt32BE(valueLen, 4, true);
	} else if(keyLen > 127) {
		bufHead = new Buffer(5);
		headData.readUInt32BE(keyLen, 0, true);
		headData.readUInt8(valueLen, 4, true);
	} else if(valueLen > 127) {
		bufHead = new Buffer(5);
		headData.readUInt8(keyLen, 0, true);
		headData.readUInt32BE(valueLen, 1, true);
	} else {
		bufHead = new Buffer(2);
		headData.readUInt8(keyLen, 0, true);
		headData.readUInt8(valueLen, 1, true);
	}
	return [
		bufHead,
		bufKey,
		bufValue,
		bufHead.length + keyLen + valueLen
	];
};

module.exports = function(kv){
	var bufs = [];
	var bufsLen = 0;
	for(var k in kv) {
		var bs = stringifyPair(k, kv[k]);
		bufs.push(bs[0], bs[1], bs[2]);
		bufsLen += bs[3];
	}
	return Buffer.concat(bufs, bufsLen);
};
