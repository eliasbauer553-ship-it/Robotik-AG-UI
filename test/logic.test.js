'use strict';
const assert = require('assert');
const { classifyLine, LineBuffer, parseLastJson, rssiBars, STEP } = require('../src/parse');
const { analyze } = require('../src/hints');

const lines = [];
const lb = new LineBuffer((l) => lines.push(l));
lb.push('Searching for hub\nConnect'); lb.push('ed!\r10%\r50%\rdone\n'); lb.flush();
assert.deepStrictEqual(lines, ['Searching for hub', 'Connected!', '10%', '50%', 'done']);

assert.strictEqual(classifyLine('Searching for any hub with Pybricks service...', 0).step, STEP.SEARCH);
assert.strictEqual(classifyLine('Connected!', 1).step, STEP.CONNECTED);
assert.strictEqual(classifyLine('Disconnected', 1).step, null);
assert.strictEqual(classifyLine('Sending 45%', 2).pct, 45);
assert.strictEqual(classifyLine('Hallo vom SPIKE!', 4).kind, 'hub');
assert.strictEqual(classifyLine('error in my print', 4).kind, 'hub');
assert.strictEqual(classifyLine('Traceback (most recent call last):', 4).kind, 'error');
assert.strictEqual(classifyLine('', 0), null);

assert.deepStrictEqual(parseLastJson('noise\n[{"a":1}]\n'), [{ a: 1 }]);
assert.strictEqual(parseLastJson('nothing'), null);
assert.strictEqual(rssiBars(-55), 4); assert.strictEqual(rssiBars(-90), 1); assert.strictEqual(rssiBars(undefined), 0);

assert.strictEqual(analyze('bleak.exc.BleakError: No Pybricks hub found').id, 'no-hub');
assert.strictEqual(analyze('ModuleNotFoundError: No module named bleak').id, 'env-missing');
assert.strictEqual(analyze('Bluetooth is turned off').id, 'bt-off');
assert.strictEqual(analyze('Device or resource busy').id, 'busy');
assert.strictEqual(analyze('SyntaxError: invalid syntax').id, 'py-syntax');
assert.strictEqual(analyze('all fine'), null);
console.log('logic tests ok');
