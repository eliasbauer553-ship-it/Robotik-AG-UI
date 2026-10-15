'use strict';
const vscode = require('vscode');
const path = require('path');
const fs = require('fs');
const { execFile } = require('child_process');
const { parsePythonVersion } = require('./parse');

function exec(cmd, args, opts = {}) {
    return new Promise((resolve, reject) => {
        execFile(cmd, args, { maxBuffer: 32 * 1024 * 1024, windowsHide: true, ...opts }, (error, stdout, stderr) => {
            if (error) {
                error.stdout = String(stdout);
                error.stderr = String(stderr);
                reject(error);
                return;
            }
            resolve({ stdout: String(stdout), stderr: String(stderr) });
        });
    });
}

/** Findet ein System-Python >= 3.10 (Windows: py -3, python, python3 / sonst python3, python). */
async function findSystemPython() {
    const candidates = process.platform === 'win32'
        ? [['py', '-3'], ['python'], ['python3']]
        : [['python3'], ['python']];
    for (const cmd of candidates) {
        try {
            const { stdout, stderr } = await exec(cmd[0], [...cmd.slice(1), '--version']);
            const v = parsePythonVersion((stdout || stderr).trim());
            if (v && (v.major > 3 || (v.major === 3 && v.minor >= 10))) {
                return cmd;
            }
        } catch {
            // nächsten Kandidaten probieren
        }
    }
    return null;
}

class Environment {
    /** @param {vscode.ExtensionContext} context */
    constructor(context) {
        this.dir = context.globalStorageUri.fsPath;
        this._caps = new Map();
    }

    venvDir() {
        return path.join(this.dir, 'venv');
    }

    venvPython() {
        return process.platform === 'win32'
            ? path.join(this.venvDir(), 'Scripts', 'python.exe')
            : path.join(this.venvDir(), 'bin', 'python');
    }

    configuredPython() {
        const p = vscode.workspace.getConfiguration('robotik').get('pythonPath');
        return p && String(p).trim() ? String(p).trim() : null;
    }

    async _version(cmd) {
        try {
            const { stdout } = await exec(cmd[0], [...cmd.slice(1), '-c', 'import importlib.metadata as m, bleak; print(m.version("pybricksdev"))']);
            return stdout.trim() || null;
        } catch {
            return null;
        }
    }

    /**
     * Sucht ein Python mit installiertem pybricksdev.
     * @returns {Promise<{python:string[]|null, version:string|null, source:string}>}
     */
    async inspect() {
        const cfg = this.configuredPython();
        if (cfg) {
            const v = await this._version([cfg]);
            return { python: [cfg], version: v, source: 'Einstellung' };
        }
        const vp = this.venvPython();
        if (fs.existsSync(vp)) {
            const v = await this._version([vp]);
            if (v) {
                return { python: [vp], version: v, source: 'eigene Umgebung' };
            }
        }
        const sys = await findSystemPython();
        if (sys) {
            const v = await this._version(sys);
            return { python: sys, version: v, source: 'System' };
        }
        return { python: null, version: null, source: '' };
    }

    /** Installiert pybricksdev bevorzugt in eine eigene venv (vermeidet „externally-managed-environment“). */
    async install(log) {
        const cfg = this.configuredPython();
        const pip = (cmd) => exec(cmd[0], [...cmd.slice(1), '-m', 'pip', 'install', '-U', 'pybricksdev']);
        if (cfg) {
            log('📦 Installiere pybricksdev in das eingestellte Python…');
            await pip([cfg]);
            return;
        }
        const sys = await findSystemPython();
        if (!sys) {
            const e = new Error('NO_PYTHON');
            e.code = 'NO_PYTHON';
            throw e;
        }
        try {
            if (!fs.existsSync(this.venvPython())) {
                log('📦 Erstelle eigene Python-Umgebung (einmalig)…');
                fs.mkdirSync(this.dir, { recursive: true });
                await exec(sys[0], [...sys.slice(1), '-m', 'venv', this.venvDir()]);
            }
            log('📦 Installiere pybricksdev (Internet nötig)…');
            await pip([this.venvPython()]);
        } catch (err) {
            log(`⚠️ Eigene Umgebung nicht möglich (${firstLine(err)}). Versuche System-Python…`);
            await pip(sys);
        }
    }

    async update(log) {
        const info = await this.inspect();
        if (!info.python) {
            return this.install(log);
        }
        log('⬆️ Aktualisiere pybricksdev…');
        await exec(info.python[0], [...info.python.slice(1), '-m', 'pip', 'install', '-U', 'pybricksdev']);
        this._caps.clear();
    }

    /** Welche Optionen kennt `pybricksdev run ble` in der installierten Version? */
    async capabilities(python, version) {
        const key = `${python.join(' ')}@${version}`;
        if (this._caps.has(key)) {
            return this._caps.get(key);
        }
        let help = '';
        try {
            const r = await exec(python[0], [...python.slice(1), '-m', 'pybricksdev', 'run', 'ble', '--help']);
            help = r.stdout + r.stderr;
        } catch (e) {
            help = String((e && (e.stdout || '')) + (e && (e.stderr || '')));
        }
        const caps = { noStart: /--no-start/.test(help), noWait: /--no-wait/.test(help), name: /--name|-n\b/.test(help) || help === '' };
        this._caps.set(key, caps);
        return caps;
    }
}

function firstLine(err) {
    return String((err && (err.stderr || err.message)) || err).trim().split(/\r?\n/).pop();
}

module.exports = { Environment, findSystemPython, exec };
