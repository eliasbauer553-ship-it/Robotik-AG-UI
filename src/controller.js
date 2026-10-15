'use strict';
const vscode = require('vscode');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const { Environment, syntaxCheck, installStubs } = require('./env');
const ble = require('./ble');
const { STEP, LineBuffer, classifyLine, rssiBars } = require('./parse');
const { analyze } = require('./hints');
const { TEMPLATES } = require('./templates');
const { SidebarProvider } = require('./sidebar');
const { parseValues } = require('./live');
const { findErrorLocation } = require('./diagnostics');
const { staticChecks } = require('./preflight');
const { loadTasks } = require('./tasks');

const CMD = {
    run: 'robotik-extension.downloadMainSpike',
    upload: 'robotik-extension.uploadOnly',
    stop: 'robotik-extension.stop',
    scan: 'robotik-extension.scanHubs',
    clear: 'robotik-extension.clearHubProgram',
    template: 'robotik-extension.newFromTemplate',
    env: 'robotik-extension.checkEnvironment',
    open: 'robotik-extension.openPanel',
    multi: 'robotik-extension.multiUpload',
    autocomplete: 'robotik-extension.setupAutocomplete',
    project: 'robotik-extension.newProject',
    diagnostics: 'robotik-extension.copyDiagnostics'
};

class Controller {
    /** @param {vscode.ExtensionContext} context */
    constructor(context) {
        this.ctx = context;
        this.env = new Environment(context);
        this.out = vscode.window.createOutputChannel('Pybricks SPIKE');
        this.sidebar = new SidebarProvider(context.extensionUri, this);
        this.status = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 50);
        this.status.command = CMD.open;

        this.logBuf = [];
        this.runner = null;
        this.hint = null;
        this.scanning = false;
        this.scanned = false;
        this.found = [];
        this.tests = {};
        this.envState = { status: 'unknown', version: null };
        this.run = { status: 'idle', mode: 'run', file: null, step: 0, startedAt: 0 };
        this.activeFile = null;
        this.idleTimer = null;
        this.lastPctBucket = -1;
        this.recent = [];
        this.stderrTail = [];
        this.tasks = [];
        this.multi = { active: false, mode: 'run', items: [], cancelled: false };
        this.diag = vscode.languages.createDiagnosticCollection('robotik');

        const ed = vscode.window.activeTextEditor;
        if (ed) { this._trackEditor(ed); }
    }

    dispose() {
        this._killRunner();
        this._killMulti();
        this.out.dispose();
        this.status.dispose();
        this.diag.dispose();
    }

    // ───────────────────────── Registrierung ─────────────────────────
    register() {
        const c = this.ctx;
        const reg = (id, fn) => c.subscriptions.push(vscode.commands.registerCommand(id, fn));
        c.subscriptions.push(
            vscode.window.registerWebviewViewProvider('robotik.sidebar', this.sidebar, { webviewOptions: { retainContextWhenHidden: true } }),
            vscode.window.onDidChangeActiveTextEditor((ed) => { if (ed && this._trackEditor(ed)) { this.pushState(); } }),
            vscode.workspace.onDidSaveTextDocument((doc) => this._onSave(doc)),
            vscode.workspace.onDidChangeConfiguration((e) => { if (e.affectsConfiguration('robotik')) { this.pushState(); } })
        );
        reg(CMD.run, () => this.runFile('run'));
        reg(CMD.upload, () => this.runFile('upload'));
        reg(CMD.stop, () => this.stop());
        reg(CMD.scan, () => this.scan());
        reg(CMD.clear, () => this.clearHubProgram());
        reg(CMD.template, () => this.newFromTemplate());
        reg(CMD.env, () => this.checkEnv());
        reg(CMD.multi, () => this.multiRun());
        reg(CMD.autocomplete, () => this.setupAutocomplete(false));
        reg(CMD.project, () => this.newProject());
        reg(CMD.diagnostics, () => this.copyDiagnostics());
        reg(CMD.open, () => vscode.commands.executeCommand('workbench.view.extension.robotik'));
        this._updateStatusBar();
        this.status.show();
        this.refreshEnv();
    }

    // ───────────────────────── Zustand ─────────────────────────
    get cfg() { return vscode.workspace.getConfiguration('robotik'); }
    get savedHubs() { return this.ctx.globalState.get('hubs', []); }
    get selectedHub() { return this.ctx.globalState.get('selectedHub', null); }
    get busy() { return !!this.runner || this.multi.active; }
    get history() { return this.ctx.globalState.get('history', []); }

    _trackEditor(ed) {
        const d = ed.document;
        if (d.uri.scheme === 'file' && d.fileName.toLowerCase().endsWith('.py')) {
            this.activeFile = d.uri.fsPath;
            return true;
        }
        return false;
    }

    getState() {
        const saved = this.savedHubs;
        const sel = this.selectedHub;
        const hubs = saved.map((h) => ({ ...h, saved: true }));
        for (const f of this.found) {
            const existing = hubs.find((h) => h.name === f.name);
            if (!existing) { hubs.push({ name: f.name, address: f.address, saved: false }); }
        }
        for (const h of hubs) {
            const f = this.found.find((x) => x.name === h.name || x.address === h.address);
            h.inRange = !!f;
            h.rssi = f ? f.rssi : undefined;
            h.bars = f ? rssiBars(f.rssi) : 0;
            h.selected = sel === h.name;
            h.test = this.tests[h.name];
        }
        return {
            env: this.envState,
            hubs,
            selectedHub: sel,
            scanning: this.scanning,
            scanned: this.scanned,
            run: { status: this.run.status, mode: this.run.mode, step: this.run.step },
            busy: this.busy,
            multi: { active: this.multi.active, mode: this.multi.mode, items: this.multi.items.map((i) => ({ name: i.name, status: i.status, step: i.step })) },
            tasks: this.tasks.map((t) => ({ id: t.id, title: t.title, level: t.level, goal: t.goal, hints: t.hints, hasStarter: !!t.starter, custom: t.custom })),
            activeFile: this.activeFile ? { name: path.basename(this.activeFile), path: this.activeFile } : null,
            history: this.history.map((h, i) => ({ ...h, index: i })),
            hint: this.hint,
            settings: {
                saveBeforeRun: this.cfg.get('saveBeforeRun'),
                autoRunOnSave: this.cfg.get('autoRunOnSave'),
                clearLogOnRun: this.cfg.get('clearLogOnRun')
            }
        };
    }

    pushState() {
        this.sidebar.post({ type: 'state', state: this.getState() });
        this._updateStatusBar();
    }

    onReady() {
        const root = vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders[0];
        this.tasks = loadTasks(root ? root.uri.fsPath : null);
        this.sidebar.post({ type: 'logReset', entries: this.logBuf });
        this.pushState();
    }

    _updateStatusBar() {
        const hub = this.selectedHub || 'Auto';
        const s = this.multi.active ? 'busy' : this.run.status;
        if (this.multi.active) {
            this.status.text = `$(sync~spin) SPIKE: Klassenmodus (${this.multi.items.filter((i) => i.status === 'done').length}/${this.multi.items.length})`;
        } else if (s === 'busy') {
            this.status.text = `$(sync~spin) SPIKE: ${['Umgebung', 'Suche', 'Verbunden', 'Übertrage', 'Läuft', ''][this.run.step] || ''}…`;
        } else if (s === 'done') {
            this.status.text = '$(check) SPIKE: Fertig';
        } else if (s === 'error') {
            this.status.text = '$(error) SPIKE: Fehler';
        } else {
            this.status.text = `$(circuit-board) SPIKE: ${hub}`;
        }
        this.status.tooltip = 'Robotik-Steuerung öffnen';
    }

    log(kind, text) {
        const entry = { t: Date.now(), kind, text };
        this.logBuf.push(entry);
        if (this.logBuf.length > 400) { this.logBuf.shift(); }
        const prefix = { error: '❌ ', ok: '✅ ', warn: '⚠️ ', step: '🔗 ', hub: '🤖 ' }[kind] || '';
        this.out.appendLine(prefix + text);
        this.sidebar.post({ type: 'log', entry });
    }

    clearLog() {
        this.logBuf = [];
        this.out.clear();
        this.sidebar.post({ type: 'logReset', entries: [] });
    }

    setRun(patch) {
        Object.assign(this.run, patch);
        this.pushState();
    }

    advance(step) {
        if (step > this.run.step) { this.setRun({ step }); }
    }

    // ───────────────────────── Umgebung ─────────────────────────
    async refreshEnv() {
        try {
            const info = await this.env.inspect();
            this.envState = info.version ? { status: 'ok', version: info.version } : { status: 'missing', version: null };
        } catch {
            this.envState = { status: 'missing', version: null };
        }
        this.pushState();
        return this.envState;
    }

    /** Stellt sicher, dass Python + pybricksdev bereitstehen (installiert bei Bedarf automatisch). */
    async ensureEnv() {
        let info = await this.env.inspect();
        if (info.python && info.version) {
            this.envState = { status: 'ok', version: info.version };
            this.pushState();
            return info;
        }
        if (!info.python) {
            this.envState = { status: 'missing', version: null };
            this.log('error', 'Kein Python 3.10+ gefunden.');
            this.log('info', 'Bitte Python von python.org installieren (Windows: „Add python.exe to PATH“ anhaken) und VS Code neu starten.');
            this.hint = { title: 'Python fehlt', text: 'Für die Verbindung zum Hub wird Python 3.10 oder neuer gebraucht.', steps: ['Von python.org installieren (Windows: „Add python.exe to PATH“ anhaken).', 'VS Code danach neu starten.'], action: { label: 'Erneut prüfen', type: 'checkEnv' } };
            this.pushState();
            vscode.window.showErrorMessage('Kein Python 3.10+ gefunden. Bitte Python installieren und VS Code neu starten.');
            return null;
        }
        this.envState = { status: 'installing', version: null };
        this.pushState();
        try {
            await vscode.window.withProgress(
                { location: vscode.ProgressLocation.Notification, title: 'Robotik: Richte pybricksdev ein (einmalig)…' },
                () => this.env.install((l) => this.log('info', l))
            );
        } catch (err) {
            const msg = String((err && (err.stderr || err.message)) || err).trim();
            this.envState = { status: 'missing', version: null };
            this.log('error', 'Installation fehlgeschlagen: ' + msg.split(/\r?\n/).slice(-4).join(' | '));
            this.hint = { title: 'Installation fehlgeschlagen', text: 'pybricksdev konnte nicht installiert werden (Internet vorhanden?).', steps: ['Manuell versuchen: python -m pip install -U pybricksdev', 'Unter Linux evtl. zuerst: sudo apt install python3-venv'], action: { label: 'Nochmal versuchen', type: 'checkEnv' } };
            this.pushState();
            return null;
        }
        info = await this.env.inspect();
        if (!info.version) {
            this.envState = { status: 'missing', version: null };
            this.pushState();
            return null;
        }
        this.envState = { status: 'ok', version: info.version };
        this.log('ok', `pybricksdev ${info.version} bereit.`);
        this.pushState();
        this.setupAutocomplete(true);
        return info;
    }

    async checkEnv() {
        this.hint = null;
        this.log('info', 'Prüfe Umgebung…');
        const info = await this.ensureEnv();
        if (info) {
            this.log('ok', `Python: ${info.python.join(' ')} (${info.source}) · pybricksdev ${info.version}`);
            vscode.window.showInformationMessage(`Robotik: Alles bereit (pybricksdev ${info.version}).`);
        }
    }

    async updateEnv() {
        try {
            this.envState = { status: 'installing', version: null };
            this.pushState();
            await vscode.window.withProgress(
                { location: vscode.ProgressLocation.Notification, title: 'Robotik: Aktualisiere pybricksdev…' },
                () => this.env.update((l) => this.log('info', l))
            );
            const info = await this.refreshEnv();
            this.hint = null;
            this.log('ok', `pybricksdev aktualisiert (${info.version || '?'}).`);
        } catch (err) {
            await this.refreshEnv();
            this.log('error', 'Aktualisierung fehlgeschlagen: ' + String((err && (err.stderr || err.message)) || err).trim().split(/\r?\n/).pop());
        }
    }

    // ───────────────────────── Hubs ─────────────────────────
    async scan() {
        if (this.scanning || this.run.status === 'busy') { return; }
        this.hint = null;
        const info = await this.ensureEnv();
        if (!info) { return; }
        this.scanning = true;
        this.pushState();
        const timeout = Math.min(30, Math.max(2, Number(this.cfg.get('scanTimeout')) || 6));
        this.log('step', `Suche Pybricks-Hubs (${timeout} s)…`);
        try {
            this.found = await ble.scan(info.python, timeout);
            this.scanned = true;
            if (this.found.length) {
                this.log('ok', `${this.found.length} Hub(s) gefunden: ${this.found.map((h) => h.name).join(', ')}`);
            } else {
                this.log('warn', 'Kein Hub gefunden.');
                this.hint = analyze('no pybricks hub found');
            }
        } catch (err) {
            this.found = [];
            this.log('error', 'Suche fehlgeschlagen: ' + String(err.message || err).split(/\r?\n/).pop());
            this.hint = analyze(err.message) || analyze('bluetooth unavailable');
        } finally {
            this.scanning = false;
            this.pushState();
        }
    }

    selectHub(name, address) {
        if (name) {
            const saved = this.savedHubs;
            if (!saved.find((h) => h.name === name)) {
                const f = this.found.find((x) => x.name === name);
                saved.push({ name, address: address || (f && f.address) || '' });
                this.ctx.globalState.update('hubs', saved);
            }
            this.ctx.globalState.update('selectedHub', name);
            this.log('info', `Hub „${name}“ ausgewählt.`);
        } else {
            this.ctx.globalState.update('selectedHub', null);
            this.log('info', 'Automatische Hub-Wahl aktiviert.');
        }
        this.pushState();
    }

    async forgetHub(name) {
        const pick = await vscode.window.showWarningMessage(`Hub „${name}“ aus der Liste löschen?`, { modal: true }, 'Löschen');
        if (pick !== 'Löschen') { return; }
        await this.ctx.globalState.update('hubs', this.savedHubs.filter((h) => h.name !== name));
        if (this.selectedHub === name) { await this.ctx.globalState.update('selectedHub', null); }
        delete this.tests[name];
        this.log('info', `Hub „${name}“ gelöscht.`);
        this.pushState();
    }

    async addHub() {
        const name = await vscode.window.showInputBox({
            title: 'Hub-Name',
            prompt: 'Name des Hubs, so wie er in Pybricks Code eingestellt ist',
            placeHolder: 'z. B. Pybricks Hub',
            validateInput: (v) => (v.trim() ? undefined : 'Bitte einen Namen eingeben')
        });
        if (name && name.trim()) { this.selectHub(name.trim(), ''); }
    }

    async testHub(name, address) {
        if (this.run.status === 'busy') { return; }
        const info = await this.ensureEnv();
        if (!info) { return; }
        this.tests[name] = { busy: true };
        this.pushState();
        this.log('step', `Teste Verbindung zu „${name}“…`);
        try {
            const res = await ble.testConnection(info.python, name, address, 10);
            this.tests[name] = { ok: !!res.ok };
            if (res.ok) {
                this.log('ok', `Verbindung zu „${name}“ funktioniert.`);
                this.hint = null;
            } else {
                this.log('error', `„${name}“ nicht erreichbar.`);
                this.hint = analyze(res.error || 'not found');
            }
        } catch (err) {
            this.tests[name] = { ok: false };
            this.log('error', 'Verbindungstest fehlgeschlagen: ' + String(err.message || err).split(/\r?\n/).pop());
            this.hint = analyze(err.message) || analyze('not found');
        }
        this.pushState();
    }

    // ───────────────────────── Upload / Start ─────────────────────────
    _resolveFile() {
        const ed = vscode.window.activeTextEditor;
        if (ed) {
            const p = ed.document.uri.fsPath;
            if (ed.document.uri.scheme === 'file' && p.toLowerCase().endsWith('.py')) {
                this.activeFile = p;
                return p;
            }
        }
        return this.activeFile;
    }

    async pickFile() {
        const files = await vscode.workspace.findFiles('**/*.py', '**/{node_modules,.venv,venv,__pycache__}/**', 100);
        if (!files.length) {
            const sel = await vscode.window.showOpenDialog({ canSelectMany: false, filters: { Python: ['py'] } });
            if (sel && sel[0]) { this.activeFile = sel[0].fsPath; this.pushState(); }
            return;
        }
        const items = files.map((u) => ({ label: path.basename(u.fsPath), description: vscode.workspace.asRelativePath(u), fsPath: u.fsPath }));
        const pick = await vscode.window.showQuickPick(items, { title: 'Python-Datei für den Hub wählen' });
        if (pick) { this.activeFile = pick.fsPath; this.pushState(); }
    }

    async runFile(mode, fileOverride) {
        if (this.busy) {
            this.log('warn', 'Es läuft bereits ein Vorgang. Erst „Stop“ drücken.');
            return;
        }
        const file = fileOverride || this._resolveFile();
        if (!file) {
            vscode.window.showErrorMessage('Keine .py-Datei geöffnet! Bitte eine Python-Datei öffnen und dann ⬇️ Spike drücken.');
            return;
        }
        if (!fs.existsSync(file)) {
            vscode.window.showErrorMessage(`Datei nicht gefunden: ${file}`);
            return;
        }
        if (this.cfg.get('saveBeforeRun')) {
            const doc = vscode.workspace.textDocuments.find((d) => d.uri.fsPath === file && d.isDirty);
            if (doc) { await doc.save(); }
        }

        this.hint = null;
        if (this.cfg.get('clearLogOnRun')) { this.clearLog(); }
        this.lastPctBucket = -1;
        this.stderrTail = [];
        this.recent = [];
        this.diag.clear();
        this.sidebar.post({ type: 'valuesReset' });
        this.setRun({ status: 'busy', mode, file, step: STEP.ENV, startedAt: Date.now() });
        this.log('info', `Datei: ${file}`);

        const info = await this.ensureEnv();
        if (!info) { this.setRun({ status: 'error' }); return; }
        const caps = await this.env.capabilities(info.python, info.version);

        if (!(await this._preflight(info.python, file))) {
            this.setRun({ status: 'error' });
            return;
        }

        const hub = this.selectedHub;
        const args = [...info.python.slice(1), '-m', 'pybricksdev', 'run', 'ble'];
        if (hub) { args.push('--name', hub); }
        if (mode !== 'run') {
            if (!caps.noStart) {
                this.log('error', 'Diese pybricksdev-Version kann nicht „nur hochladen“.');
                this.hint = analyze('incompatible mpy');
                this.setRun({ status: 'error' });
                return;
            }
            args.push('--no-start');
        }
        args.push(file);

        this.log('step', hub ? `Verbinde mit „${hub}“ …` : 'Suche Hub (bitte einschalten, Bluetooth an) …');
        this.advance(STEP.SEARCH);

        const child = spawn(info.python[0], args, {
            windowsHide: true,
            env: { ...process.env, PYTHONUNBUFFERED: '1', PYTHONIOENCODING: 'utf-8' }
        });
        this.runner = { child, stopped: false };
        const feed = (stream) => new LineBuffer((line) => this._onLine(stream, line, mode));
        const so = feed('stdout');
        const se = feed('stderr');
        child.stdout.on('data', (d) => { so.push(d); this._armIdle(mode); });
        child.stderr.on('data', (d) => { se.push(d); this._armIdle(mode); });
        child.on('error', (err) => {
            this.log('error', `Prozess konnte nicht gestartet werden: ${err.message}`);
            this._finish(null, null, mode, hub);
        });
        child.on('close', (code, signal) => {
            so.flush(); se.flush();
            this._finish(code, signal, mode, hub);
        });
    }

    _onLine(stream, line, mode) {
        const c = classifyLine(line, this.run.step);
        if (!c) { return; }
        if (stream === 'stderr') {
            this.stderrTail.push(line);
            if (this.stderrTail.length > 40) { this.stderrTail.shift(); }
        }
        if (c.pct !== undefined) {
            const bucket = Math.floor(c.pct / 20);
            if (bucket === this.lastPctBucket) { return; }
            this.lastPctBucket = bucket;
        }
        if (c.step !== null) { this.advance(c.step); }
        if (c.kind === 'hub' && mode === 'run') { this.advance(STEP.RUNNING); }
        this.recent.push(line);
        if (this.recent.length > 80) { this.recent.shift(); }
        if (c.kind === 'hub') {
            const values = parseValues(line);
            if (Object.keys(values).length) { this.sidebar.post({ type: 'values', values }); }
        }
        this.log(c.kind === 'hub' ? 'hub' : c.kind, line.trim());
    }

    /** Wenn nach dem Verbinden/Übertragen eine Weile nichts mehr kommt, läuft das Programm vermutlich. */
    _armIdle(mode) {
        clearTimeout(this.idleTimer);
        if (mode !== 'run') { return; }
        this.idleTimer = setTimeout(() => {
            if (this.runner && this.run.step >= STEP.CONNECTED && this.run.step < STEP.RUNNING) {
                this.advance(STEP.RUNNING);
                this.log('step', 'Programm läuft auf dem Hub.');
            }
        }, 2500);
    }

    _finish(code, signal, mode, hub) {
        clearTimeout(this.idleTimer);
        const wasStopped = this.runner && this.runner.stopped;
        this.runner = null;
        const ms = Date.now() - this.run.startedAt;
        let status;
        if (wasStopped) {
            status = 'stopped';
            this.log('warn', 'Gestoppt.');
        } else if (code === 0) {
            status = 'done';
            this.log('ok', mode === 'run' ? 'Programm beendet.' : 'Programm auf den Hub übertragen.');
            this.setRun({ step: STEP.DONE });
        } else {
            status = 'error';
            this.log('error', `Vorgang mit Fehler beendet (${signal ? 'Signal ' + signal : 'Exit-Code ' + code}).`);
            this.hint = analyze(this.stderrTail.join('\n')) || analyze(this.logBuf.slice(-15).map((e) => e.text).join('\n')) ||
                { title: 'Upload fehlgeschlagen', text: 'Details stehen im Live-Log.', steps: ['Hub eingeschaltet und nah dran?', 'Läuft ein anderes Programm mit Bluetooth-Verbindung zum Hub?', 'Erneut versuchen.'] };
        }
        this._markErrorLine(this.run.file);
        const history = this.history;
        history.unshift({ file: path.basename(this.run.file || ''), path: this.run.file || '', mode, hub: hub || 'Auto', status, at: Date.now(), ms });
        this.ctx.globalState.update('history', history.slice(0, 12));
        this.setRun({ status });
    }

    stop() {
        if (this.multi.active) { this._killMulti(true); }
        if (!this.runner) { return; }
        this.runner.stopped = true;
        this.log('info', 'Stoppe…');
        this._killRunner();
    }

    _killRunner() {
        if (!this.runner) { return; }
        this._killChild(this.runner.child);
    }

    _killChild(child) {
        try {
            if (process.platform === 'win32') {
                child.kill();
            } else {
                child.kill('SIGINT');
                setTimeout(() => { if (child.exitCode === null) { child.kill('SIGKILL'); } }, 3000);
            }
        } catch { /* Prozess ist schon weg */ }
    }

    async clearHubProgram() {
        const pick = await vscode.window.showWarningMessage(
            'Das Programm auf dem Hub wird durch ein leeres Programm überschrieben. Fortfahren?',
            { modal: true }, 'Programm löschen'
        );
        if (pick !== 'Programm löschen') { return; }
        fs.mkdirSync(this.env.dir, { recursive: true });
        const empty = path.join(this.env.dir, 'leeres_programm.py');
        fs.writeFileSync(empty, '# Robotik: leeres Programm (überschreibt das Hub-Programm)\n');
        await this.runFile('upload', empty);
    }

    async newFromTemplate() {
        const pick = await vscode.window.showQuickPick(
            TEMPLATES.map((t) => ({ label: t.label, detail: t.detail, t })),
            { title: 'Vorlage für ein neues SPIKE-Programm' }
        );
        if (!pick) { return; }
        const folder = vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders[0];
        let target;
        if (folder) {
            target = await vscode.window.showSaveDialog({ defaultUri: vscode.Uri.joinPath(folder.uri, pick.t.file), filters: { Python: ['py'] } });
            if (!target) { return; }
            await vscode.workspace.fs.writeFile(target, Buffer.from(pick.t.code, 'utf8'));
            await vscode.window.showTextDocument(await vscode.workspace.openTextDocument(target));
        } else {
            const doc = await vscode.workspace.openTextDocument({ language: 'python', content: pick.t.code });
            await vscode.window.showTextDocument(doc);
        }
    }

    // ───────────────────────── Diagnosebericht ─────────────────────────
    async copyDiagnostics() {
        let info = {};
        try { info = await this.env.inspect(); } catch { /* Bericht trotzdem erzeugen */ }
        let caps = null;
        if (info.python && info.version) {
            try { caps = await this.env.capabilities(info.python, info.version); } catch { /* optional */ }
        }
        const version = (this.ctx.extension && this.ctx.extension.packageJSON && this.ctx.extension.packageJSON.version) || '?';
        const lines = [
            `Robotik-Erweiterung ${version}`,
            `VS Code ${vscode.version} · ${process.platform} ${process.arch}`,
            `Python: ${info.python ? info.python.join(' ') : 'nicht gefunden'} (${info.source || '-'})`,
            `pybricksdev: ${info.version || 'nicht installiert'}`,
            `Optionen von "run ble": ${caps ? JSON.stringify(caps) : '-'}`,
            `Gewählter Hub: ${this.selectedHub || 'Automatisch'}`,
            '',
            '--- Log (letzte 60 Zeilen) ---',
            ...this.logBuf.slice(-60).map((e) => `[${e.kind}] ${e.text}`)
        ];
        await vscode.env.clipboard.writeText(lines.join('\n'));
        vscode.window.showInformationMessage('Robotik: Diagnosebericht kopiert (enthält Dateipfade) – zum Beispiel in eine Mail oder ein Ticket einfügen.');
    }

    // ───────────────────────── Vorab-Prüfung & Fehlerstellen im Editor ─────────────────────────
    _range(line) {
        const l = Math.max(0, line - 1);
        return new vscode.Range(l, 0, l, 1000);
    }

    /** Syntax + typische Anfängerfehler. @returns {Promise<boolean>} false = Abbruch */
    async _preflight(python, file) {
        const uri = vscode.Uri.file(file);
        const syn = await syntaxCheck(python, file);
        if (syn) {
            const d = new vscode.Diagnostic(this._range(syn.line), syn.message, vscode.DiagnosticSeverity.Error);
            d.source = 'Robotik (Vorab-Prüfung)';
            this.diag.set(uri, [d]);
            this.log('error', `Syntaxfehler in Zeile ${syn.line}: ${syn.message}`);
            this.log('info', 'Nichts wurde zum Hub gesendet.');
            this.hint = analyze('SyntaxError');
            this._offerJump(file, syn.line, syn.message);
            return false;
        }
        let text = '';
        try { text = fs.readFileSync(file, 'utf8'); } catch { return true; }
        const diags = staticChecks(text).map((w) => {
            if (w.severity === 'warning') { this.log('warn', `Zeile ${w.line}: ${w.message}`); }
            const d = new vscode.Diagnostic(this._range(w.line), w.message, w.severity === 'warning' ? vscode.DiagnosticSeverity.Warning : vscode.DiagnosticSeverity.Information);
            d.source = 'Robotik (Vorab-Prüfung)';
            return d;
        });
        this.diag.set(uri, diags);
        return true;
    }

    _offerJump(file, line, message) {
        vscode.window.showErrorMessage(`Zeile ${line}: ${message}`, 'Zur Zeile springen').then(async (pick) => {
            if (pick) {
                const doc = await vscode.workspace.openTextDocument(vscode.Uri.file(file));
                const ed = await vscode.window.showTextDocument(doc);
                const r = this._range(line);
                ed.selection = new vscode.Selection(r.start, r.start);
                ed.revealRange(r, vscode.TextEditorRevealType.InCenter);
            }
        });
    }

    /** Markiert die Zeile eines Hub-Tracebacks im Editor. */
    _markErrorLine(file) {
        const loc = findErrorLocation(this.recent);
        if (!loc || !file) { return; }
        const d = new vscode.Diagnostic(this._range(loc.line), loc.message, vscode.DiagnosticSeverity.Error);
        d.source = 'Robotik (Hub)';
        this.diag.set(vscode.Uri.file(file), [d]);
        this.log('error', `Fehler in Zeile ${loc.line}: ${loc.message}`);
        this._offerJump(file, loc.line, loc.message);
    }

    // ───────────────────────── Autovervollständigung ─────────────────────────
    async setupAutocomplete(silent) {
        try {
            const info = await this.env.inspect();
            if (!info.python || !info.version) {
                if (!silent) { vscode.window.showWarningMessage('Robotik: Erst die Umgebung einrichten (Werkzeuge → Umgebung prüfen).'); }
                return;
            }
            const sp = await installStubs(info.python, (l) => this.log('info', l));
            const conf = vscode.workspace.getConfiguration('python.analysis');
            const cur = conf.get('extraPaths') || [];
            if (sp && !cur.includes(sp)) {
                await conf.update('extraPaths', [...cur, sp], vscode.ConfigurationTarget.Global);
            }
            this.log('ok', 'Autovervollständigung für Pybricks eingerichtet.');
            const hasPy = vscode.extensions.getExtension('ms-python.vscode-pylance') || vscode.extensions.getExtension('ms-python.python');
            if (!silent) {
                vscode.window.showInformationMessage(hasPy
                    ? 'Robotik: Autovervollständigung eingerichtet. Falls noch keine Vorschläge kommen: Fenster neu laden.'
                    : 'Robotik: Eingerichtet – dafür wird zusätzlich die Erweiterung „Python“ (Pylance) von Microsoft gebraucht.');
            }
        } catch (err) {
            this.log('warn', 'Autovervollständigung konnte nicht eingerichtet werden: ' + String((err && (err.stderr || err.message)) || err).trim().split(/\r?\n/).pop());
        }
    }

    // ───────────────────────── Klassenmodus (mehrere Hubs) ─────────────────────────
    async multiRun() {
        if (this.busy) {
            this.log('warn', 'Es läuft bereits ein Vorgang. Erst „Stop“ drücken.');
            return;
        }
        const file = this._resolveFile();
        if (!file) {
            vscode.window.showErrorMessage('Keine .py-Datei geöffnet! Bitte erst die Datei öffnen, die auf alle Hubs soll.');
            return;
        }
        const known = new Map();
        this.savedHubs.forEach((h) => known.set(h.name, h));
        this.found.forEach((h) => { if (!known.has(h.name)) { known.set(h.name, h); } });
        if (!known.size) {
            const a = await vscode.window.showInformationMessage('Noch keine Hubs bekannt. Erst nach Hubs suchen (alle Hubs einschalten).', 'Jetzt suchen');
            if (a) { await this.scan(); }
            return;
        }
        const inRange = (n) => this.found.some((f) => f.name === n);
        const picks = await vscode.window.showQuickPick(
            [...known.values()].map((h) => ({ label: h.name, description: inRange(h.name) ? 'in Reichweite' : this.scanned ? 'nicht gefunden' : '', picked: inRange(h.name), hub: h })),
            { canPickMany: true, title: `Klassenmodus: ${path.basename(file)} auf welche Hubs?` }
        );
        if (!picks || !picks.length) { return; }
        const modePick = await vscode.window.showQuickPick(
            [
                { label: 'Nur hochladen', detail: 'Programm startet später per Knopf am Hub (empfohlen)', mode: 'upload' },
                { label: 'Hochladen & starten', detail: 'Alle Hubs starten das Programm sofort', mode: 'run' }
            ],
            { title: 'Was soll passieren?' }
        );
        if (!modePick) { return; }
        const mode = modePick.mode;

        if (this.cfg.get('saveBeforeRun')) {
            const doc = vscode.workspace.textDocuments.find((d) => d.uri.fsPath === file && d.isDirty);
            if (doc) { await doc.save(); }
        }
        this.hint = null;
        if (this.cfg.get('clearLogOnRun')) { this.clearLog(); }
        this.recent = [];
        this.multi = { active: true, mode, cancelled: false, items: picks.map((p) => ({ name: p.hub.name, status: 'wait', step: STEP.ENV, child: null, stopped: false, tail: [], timer: null })) };
        this.pushState();

        const info = await this.ensureEnv();
        const fail = (msg) => {
            if (msg) { this.log('error', msg); }
            this.multi.active = false;
            this.multi.items = [];
            this.pushState();
        };
        if (!info) { return fail(); }
        const caps = await this.env.capabilities(info.python, info.version);
        if (mode === 'upload' && !caps.noStart) {
            this.hint = analyze('incompatible mpy');
            return fail('Diese pybricksdev-Version kann nicht „nur hochladen“.');
        }
        if (!(await this._preflight(info.python, file))) { return fail(); }

        this.log('step', `Klassenmodus: ${path.basename(file)} → ${this.multi.items.length} Hub(s) (${mode === 'run' ? 'hochladen & starten' : 'nur hochladen'})`);
        const queue = [...this.multi.items];
        const worker = async () => {
            while (queue.length) {
                const item = queue.shift();
                if (this.multi.cancelled) { item.status = 'stopped'; this.pushState(); continue; }
                await this._runOnHub(item, info, file, mode);
            }
        };
        await Promise.all(Array.from({ length: Math.min(3, queue.length) }, worker));

        const items = this.multi.items;
        const ok = items.filter((i) => i.status === 'done').length;
        const bad = items.filter((i) => i.status === 'error');
        this.multi.active = false;
        if (bad.length) {
            this.log('warn', `${ok}/${items.length} Hubs fertig. Fehler bei: ${bad.map((b) => b.name).join(', ')}`);
            this.hint = analyze(bad.map((b) => b.tail.join('\n')).join('\n')) || analyze('no pybricks hub found');
        } else if (this.multi.cancelled) {
            this.log('warn', 'Klassenmodus gestoppt.');
        } else {
            this.log('ok', `Alle ${ok} Hubs fertig.`);
        }
        this.pushState();
    }

    _runOnHub(item, info, file, mode) {
        return new Promise((resolve) => {
            const args = [...info.python.slice(1), '-m', 'pybricksdev', 'run', 'ble', '--name', item.name];
            if (mode === 'upload') { args.push('--no-start'); }
            args.push(file);
            item.status = 'busy';
            item.step = STEP.SEARCH;
            this.pushState();
            this.log('step', `[${item.name}] verbinde…`);
            const child = spawn(info.python[0], args, { windowsHide: true, env: { ...process.env, PYTHONUNBUFFERED: '1', PYTHONIOENCODING: 'utf-8' } });
            item.child = child;
            const onLine = (stream) => new LineBuffer((line) => {
                const c = classifyLine(line, item.step);
                if (!c) { return; }
                if (stream === 'stderr' || c.kind === 'error') { item.tail.push(line); if (item.tail.length > 20) { item.tail.shift(); } }
                if (c.pct !== undefined) { return; }
                if (c.step !== null && c.step > item.step) { item.step = c.step; this.pushState(); }
                this.log(c.kind === 'hub' ? 'hub' : c.kind, `[${item.name}] ${line.trim()}`);
            });
            const so = onLine('stdout');
            const se = onLine('stderr');
            const arm = () => {
                clearTimeout(item.timer);
                if (mode !== 'run') { return; }
                item.timer = setTimeout(() => {
                    if (item.status === 'busy' && item.step >= STEP.CONNECTED && item.step < STEP.RUNNING) { item.step = STEP.RUNNING; this.pushState(); }
                }, 2500);
            };
            child.stdout.on('data', (d) => { so.push(d); arm(); });
            child.stderr.on('data', (d) => { se.push(d); arm(); });
            const end = (code) => {
                clearTimeout(item.timer);
                so.flush(); se.flush();
                item.child = null;
                item.status = item.stopped ? 'stopped' : code === 0 ? 'done' : 'error';
                if (item.status === 'done') { item.step = STEP.DONE; }
                this.log(item.status === 'done' ? 'ok' : item.status === 'stopped' ? 'warn' : 'error', `[${item.name}] ${item.status === 'done' ? 'fertig' : item.status === 'stopped' ? 'gestoppt' : 'Fehler (Exit-Code ' + code + ')'}`);
                this.pushState();
                resolve();
            };
            child.on('error', (err) => { item.tail.push(err.message); end(-1); });
            child.on('close', (code) => end(code));
        });
    }

    _killMulti(userStop) {
        if (userStop) { this.multi.cancelled = true; }
        for (const item of this.multi.items) {
            if (item.child) { item.stopped = true; this._killChild(item.child); }
        }
    }

    // ───────────────────────── Projekt & Aufgabenkarten ─────────────────────────
    async newProject() {
        const parent = await vscode.window.showOpenDialog({ canSelectFolders: true, canSelectFiles: false, canSelectMany: false, openLabel: 'Hier Projekt anlegen' });
        if (!parent || !parent[0]) { return; }
        const name = await vscode.window.showInputBox({
            title: 'Projektname', value: 'mein-roboter',
            validateInput: (v) => (/^[\w\- äöüÄÖÜß]+$/.test(v.trim()) ? undefined : 'Nur Buchstaben, Zahlen, Leerzeichen, - und _')
        });
        if (!name) { return; }
        const dir = vscode.Uri.joinPath(parent[0], name.trim());
        try {
            await vscode.workspace.fs.stat(dir);
            vscode.window.showErrorMessage(`Den Ordner „${name.trim()}“ gibt es dort schon.`);
            return;
        } catch { /* gibt es noch nicht – gut */ }
        await vscode.workspace.fs.createDirectory(dir);
        const enc = (t) => Buffer.from(t, 'utf8');
        await vscode.workspace.fs.writeFile(vscode.Uri.joinPath(dir, 'main.py'), enc(TEMPLATES[0].code));
        await vscode.workspace.fs.writeFile(vscode.Uri.joinPath(dir, 'README.md'), enc(`# ${name.trim()}\n\nSPIKE-Projekt (Pybricks).\n\n- \`main.py\` öffnen und in der Robotik-Seitenleiste **▶ Hochladen & starten** drücken.\n- Eigene Aufgabenkarten: Datei \`robotik-tasks.json\` anlegen (siehe Erweiterungs-README).\n`));
        const pick = await vscode.window.showInformationMessage(`Projekt „${name.trim()}“ angelegt.`, 'Ordner öffnen');
        if (pick) {
            vscode.commands.executeCommand('vscode.openFolder', dir);
        } else {
            await vscode.window.showTextDocument(await vscode.workspace.openTextDocument(vscode.Uri.joinPath(dir, 'main.py')));
        }
    }

    async taskStarter(id) {
        const t = this.tasks.find((x) => x.id === id);
        if (!t || !t.starter) { return; }
        const folder = vscode.workspace.workspaceFolders && vscode.workspace.workspaceFolders[0];
        if (folder) {
            const uri = vscode.Uri.joinPath(folder.uri, `aufgabe_${id}.py`);
            try {
                await vscode.workspace.fs.stat(uri);
            } catch {
                await vscode.workspace.fs.writeFile(uri, Buffer.from(t.starter, 'utf8'));
            }
            await vscode.window.showTextDocument(await vscode.workspace.openTextDocument(uri));
        } else {
            const doc = await vscode.workspace.openTextDocument({ language: 'python', content: t.starter });
            await vscode.window.showTextDocument(doc);
            vscode.window.showInformationMessage('Bitte die Datei speichern (Strg+S), dann kann sie hochgeladen werden.');
        }
    }

    _onSave(doc) {
        if (!this.cfg.get('autoRunOnSave') || this.runner) { return; }
        if (doc.uri.scheme === 'file' && doc.uri.fsPath === this.activeFile && doc.fileName.toLowerCase().endsWith('.py')) {
            this.runFile('run', doc.uri.fsPath);
        }
    }

    // ───────────────────────── Nachrichten aus der Seitenleiste ─────────────────────────
    onMessage(m) {
        switch (m.type) {
            case 'run': return this.runFile('run');
            case 'upload': return this.runFile('upload');
            case 'rerun': { const h = this.history[m.index]; return h && this.runFile(h.mode === 'run' ? 'run' : 'upload', h.path); }
            case 'stop': return this.stop();
            case 'scan': return this.scan();
            case 'selectHub': return this.selectHub(m.name, m.address);
            case 'forgetHub': return this.forgetHub(m.name);
            case 'addHub': return this.addHub();
            case 'testHub': return this.testHub(m.name, m.address);
            case 'pickFile': return this.pickFile();
            case 'copyDiagnostics': return this.copyDiagnostics();
            case 'multiRun': return this.multiRun();
            case 'autocomplete': return this.setupAutocomplete(false);
            case 'newProject': return this.newProject();
            case 'taskStarter': return this.taskStarter(m.name);
            case 'clearProgram': return this.clearHubProgram();
            case 'newFromTemplate': return this.newFromTemplate();
            case 'checkEnv': return this.checkEnv();
            case 'updateEnv': return this.updateEnv();
            case 'clearLog': return this.clearLog();
            case 'openOutput': return this.out.show(true);
            case 'link':
                if (/^https:\/\/(code|docs)\.pybricks\.com/.test(m.value || '')) { vscode.env.openExternal(vscode.Uri.parse(m.value)); }
                return undefined;
            case 'setting':
                if (['saveBeforeRun', 'autoRunOnSave', 'clearLogOnRun'].includes(m.key)) {
                    return this.cfg.update(m.key, !!m.value, vscode.ConfigurationTarget.Global);
                }
                return undefined;
            default: return undefined;
        }
    }
}

module.exports = { Controller };
