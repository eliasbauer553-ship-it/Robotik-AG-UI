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

const { parseValues } = require('../src/live');
const { findErrorLocation } = require('../src/diagnostics');
const { staticChecks } = require('../src/preflight');
const { loadTasks } = require('../src/tasks');
assert.deepStrictEqual(parseValues('Farbe: Color.RED | Abstand: 123 mm | Winkel: -4.5'), { Abstand: 123, Winkel: -4.5 });
assert.deepStrictEqual(parseValues('a=1 b=2,5'), { a: 1, b: 2.5 });
assert.deepStrictEqual(parseValues('10, 20, 30'), { 'Wert 1': 10, 'Wert 2': 20, 'Wert 3': 30 });
assert.deepStrictEqual(parseValues('Hallo vom SPIKE!'), {});
const loc = findErrorLocation(['Traceback (most recent call last):', '  File "main.py", line 7, in <module>', 'NameError: name \'x\' isn\'t defined']);
assert.strictEqual(loc.line, 7); assert.ok(loc.message.startsWith('NameError'));
assert.strictEqual(findErrorLocation(['all good']), null);
const w = staticChecks('from pybricks.pupdevices import Motor\na = Motor(Port.A)\nb = Motor(Port.A)\nimport time\ntime.sleep(1)\n');
assert.ok(w.some((x) => x.line === 3 && /Port A/.test(x.message)));
assert.ok(w.some((x) => x.line === 5));
assert.strictEqual(staticChecks('print(1)').length, 1);
assert.ok(loadTasks(null).length >= 5);
console.log('extra tests ok');
