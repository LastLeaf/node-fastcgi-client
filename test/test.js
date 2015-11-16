'use strict';

var cases = [
	'fpm',
	'phpcgi',
];

cases.forEach(function(file){
	require('./' + file + '.js');
});
