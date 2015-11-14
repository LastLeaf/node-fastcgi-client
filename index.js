'use strict';

module.exports = function(options){
	options = options || {};
	return require('./lib/main.js')(options);
};
