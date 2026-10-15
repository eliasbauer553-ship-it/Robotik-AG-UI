'use strict';
// Integrationstest mit gemocktem "vscode" und Fake-pybricksdev (test/fake/fakepy.sh)
const Module = require('module');
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const FAKE = path.join(__dirname, 'fake', 'fakepy.sh');
const T = fs.mkdtempSync(path.join(os.tmpdir(), 'robotik-'));
const clip = []; const posted = []; const diags = []; const msgs = []; const store = {};
class Range { constructor(a, b, c, d) { this.start = { line: a, character: b }; this.end = { line: c, character: d }; } }
const vscode = {
  Range, Selection: class {}, Diagnostic: class { constructor(r, m, s) { this.range = r; this.message = m; this.severity = s; } },
  DiagnosticSeverity: { Error: 0, Warning: 1, Information: 2 }, TextEditorRevealType: { InCenter: 2 },
  StatusBarAlignment: { Left: 1 }, ProgressLocation: { Notification: 15 }, ConfigurationTarget: { Global: 1 },
  Uri: { file: (p) => ({ fsPath: p, scheme: 'file' }), joinPath: (u, ...p) => ({ fsPath: [u.fsPath, ...p].join('/') }), parse: (s) => s },
  version: '1.103.0',
  window: {
    createOutputChannel: () => ({ appendLine() {}, clear() {}, show() {}, dispose() {} }),
    createStatusBarItem: () => ({ show() {}, dispose() {} }),
    registerWebviewViewProvider: () => ({ dispose() {} }), onDidChangeActiveTextEditor: () => ({ dispose() {} }),
    showErrorMessage: (m) => { msgs.push(m); return Promise.resolve(undefined); }, showInformationMessage: (m) => { msgs.push(m); return Promise.resolve(undefined); },
    showWarningMessage: () => Promise.resolve(undefined), withProgress: (o, f) => f(), activeTextEditor: undefined
  },
  languages: { createDiagnosticCollection: () => ({ clear() { diags.length = 0; }, set(u, d) { diags.push({ u, d }); }, dispose() {} }) },
  workspace: {
    getConfiguration: () => ({ get: (k) => ({ saveBeforeRun: false, clearLogOnRun: true, pythonPath: FAKE, scanTimeout: 2 }[k]), update: async () => {} }),
    onDidSaveTextDocument: () => ({ dispose() {} }), onDidChangeConfiguration: () => ({ dispose() {} }),
    textDocuments: [], workspaceFolders: undefined, fs: {}
  },
  commands: { registerCommand: () => ({ dispose() {} }), executeCommand() {} },
  extensions: { getExtension: () => undefined }, env: { openExternal() {}, clipboard: { writeText: async (t) => { clip.push(t); } } }
};
const orig = Module._load;
Module._load = function (req, ...r) { return req === 'vscode' ? vscode : orig.call(this, req, ...r); };
const { Controller } = require('../src/controller');
const ctx = { subscriptions: [], extensionUri: { fsPath: __dirname + '/..' }, globalStorageUri: { fsPath: T + '/storage' },
  globalState: { get: (k, d) => (k in store ? store[k] : d), update: async (k, v) => { store[k] = v; } } };
(async () => {
  const c = new Controller(ctx);
  c.sidebar.post = (m) => posted.push(m);
  c.register();
  c.onReady();
  assert.ok(c.getState().tasks.length >= 5);
  const wait = async (cond, ms = 8000) => { const t = Date.now(); while (!cond()) { if (Date.now() - t > ms) { throw new Error('timeout'); } await new Promise((r) => setTimeout(r, 50)); } };

  fs.writeFileSync(T + '/ok.py', 'from pybricks.hubs import PrimeHub\nprint("x")\n');
  await c.runFile('run', T + '/ok.py');
  await wait(() => !c.runner);
  assert.strictEqual(c.run.status, 'done');
  assert.ok(posted.some((m) => m.type === 'values' && m.values.Abstand === 120), 'Messwerte erkannt');
  assert.strictEqual(c.history[0].status, 'done');

  fs.writeFileSync(T + '/crash.py', 'from pybricks.hubs import PrimeHub\nprint(1)\nprint(x)  # CRASH\n');
  await c.runFile('run', T + '/crash.py');
  await wait(() => !c.runner);
  assert.strictEqual(c.run.status, 'error');
  assert.ok(diags.some((x) => x.d[0] && x.d[0].range.start.line === 2 && /NameError/.test(x.d[0].message)), 'Fehlerzeile markiert');

  fs.writeFileSync(T + '/syn.py', 'from pybricks.hubs import PrimeHub\nprint(((\n# SYNTAXFEHLER\n');
  await c.runFile('run', T + '/syn.py');
  assert.strictEqual(c.run.status, 'error'); assert.ok(!c.runner, 'bei Syntaxfehler nichts gestartet');
  console.log(JSON.stringify(diags.map(x=>x.d.map(d=>[d.range.start.line,d.message]))), c.hint && c.hint.id); assert.ok(diags.some((x) => x.d[0] && x.d[0].range.start.line === 1));

  await c.runFile('upload', T + '/ok.py');
  await wait(() => !c.runner);
  assert.strictEqual(c.run.status, 'done');

  // Klassenmodus: QuickPick mocken
  c.ctx.globalState.update('hubs', [{ name: 'Hub A', address: '' }, { name: 'Hub B', address: '' }, { name: 'Hub C', address: '' }, { name: 'Hub D', address: '' }]);
  let call = 0;
  vscode.window.showQuickPick = async (items) => (call++ === 0 ? items : { mode: 'upload' });
  c.activeFile = T + '/ok.py';
  await c.multiRun();
  assert.strictEqual(c.multi.active, false);
  assert.deepStrictEqual(c.multi.items.map((i) => i.status), ['done', 'done', 'done', 'done']);
  await c.copyDiagnostics();
  assert.ok(/pybricksdev: 2\.0\.1/.test(clip[0]) && /Log \(letzte/.test(clip[0]), 'Diagnosebericht');
  console.log('controller sim ok');
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
