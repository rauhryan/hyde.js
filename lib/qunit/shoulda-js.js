// nobody said it had to be tough!
var should = test;

// sugar up modules
var context = function(msg, fn) {
	module(msg);
	fn.call(arguments);
};

// perform some cleanup to make the output module emulator/screen friendly
QUnit.done = function(){
	var tests = document.getElementById('qunit-tests').childNodes;
	var l = tests.length;
	for (var i = 0; i<l; i++) {
		var n = tests[i];
		// replace with mobdule with should
		n.innerHTML = n.innerHTML.replace('module:', 'should');
		// kill the funk, leave the clean
		var text = n.innerText || n.textContent; //Fix for FF, see http://www.quirksmode.org/dom/w3c_html.html#t04
		n.innerHTML = text.replace(new RegExp(/\(\d+, \d+, \d+\)/g), '');
	};
};