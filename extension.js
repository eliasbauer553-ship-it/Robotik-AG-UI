const vscode = require('vscode');
const { execFile, spawn } = require('child_process');

let spikeTerminal;

/**
 * Führt ein Python-Kommando aus und gibt stdout zurück.
 * @param {string[]} pythonCmd z.B. ['python'] oder ['py', '-3']
 */
function runPythonVersion(pythonCmd) {
    return new Promise((resolve, reject) => {
        execFile(pythonCmd[0], [...pythonCmd.slice(1), '--version'], (error, stdout, stderr) => {
            if (error) {
                reject(error);
                return;
            }
            resolve((stdout || stderr || '').trim());
        });
    });
}

function parsePythonVersion(text) {
    const m = /Python\s+(\d+)\.(\d+)\.(\d+)/i.exec(text || '');
    if (!m) {
        return null;
    }
    return { major: Number(m[1]), minor: Number(m[2]), patch: Number(m[3]) };
}

/**
 * Findet ein passendes System-Python (>= 3.10), plattformneutral.
 * Windows: py -3, python, python3 / Mac+Linux: python3, python
 */
async function resolvePython() {
    const candidates = process.platform === 'win32'
        ? [['py', '-3'], ['python'], ['python3']]
        : [['python3'], ['python']];

    for (const cmd of candidates) {
        try {
            const text = await runPythonVersion(cmd);
            const v = parsePythonVersion(text);
            if (v && (v.major > 3 || (v.major === 3 && v.minor >= 10))) {
                return cmd;
            }
        } catch {
            // nächsten Kandidaten probieren
        }
    }
    return null;
}

function execFileAsync(cmd, args) {
    return new Promise((resolve, reject) => {
        execFile(cmd, args, (error, stdout, stderr) => {
            if (error) {
                error.stdout = stdout;
                error.stderr = stderr;
                reject(error);
                return;
            }
            resolve({ stdout, stderr });
        });
    });
}

/**
 * Stellt sicher, dass `pybricksdev` für das gefundene Python verfügbar ist,
 * installiert es sonst automatisch per pip nach (Komplettpaket-Gefühl).
 */
async function ensurePybricks(pythonCmd, outputChannel) {
    try {
        await execFileAsync(pythonCmd[0], [...pythonCmd.slice(1), '-m', 'pybricksdev', '--version']);
        return true;
    } catch {
        // nicht vorhanden -> installieren
    }

    outputChannel.appendLine('📦 pybricksdev nicht gefunden – installiere es jetzt automatisch...');
    const install = await vscode.window.withProgress(
        {
            location: vscode.ProgressLocation.Notification,
            title: 'Installiere pybricksdev (einmalig)…',
            cancellable: false
        },
        () => execFileAsync(pythonCmd[0], [...pythonCmd.slice(1), '-m', 'pip', 'install', '-U', 'pybricksdev'])
    ).then(
        () => true,
        (err) => {
            outputChannel.appendLine(`❌ pip-Installation fehlgeschlagen: ${(err && err.message) || err}`);
            if (err && err.stderr) {
                outputChannel.appendLine(String(err.stderr).trimEnd());
            }
            return false;
        }
    );

    if (!install) {
        const choice = await vscode.window.showErrorMessage(
            'pybricksdev konnte nicht automatisch installiert werden. Python/pip prüfen und manuell installieren: python -m pip install -U pybricksdev',
            'Anleitung kopieren'
        );
        if (choice) {
            await vscode.env.clipboard.writeText('python -m pip install -U pybricksdev');
        }
        return false;
    }

    outputChannel.appendLine('✅ pybricksdev erfolgreich installiert.');
    return true;
}

function logPybricksLine(outputChannel, data) {
    const text = String(data).trimEnd();
    if (!text) {
        return;
    }
    const lower = text.toLowerCase();
    if (lower.includes('error') || lower.includes('failed') || lower.includes('traceback')) {
        outputChannel.appendLine(`❌ [Fehler] ${text}`);
    } else if (lower.includes('connecting') || lower.includes('scanning') || lower.includes('discover')) {
        outputChannel.appendLine(`🔗 [Verbinde] ${text}`);
    } else if (lower.includes('upload') || lower.includes('transfer') || lower.includes('send')) {
        outputChannel.appendLine(`⬆️ [Übertrage] ${text}`);
    } else if (lower.includes('done') || lower.includes('complete') || lower.includes('success')) {
        outputChannel.appendLine(`✅ [Fertig] ${text}`);
    } else if (lower.includes('run')) {
        outputChannel.appendLine(`🚀 [Start] ${text}`);
    } else {
        outputChannel.appendLine(text);
    }
}

function getOrCreateTerminal() {
    if (!spikeTerminal || spikeTerminal.exitStatus !== undefined) {
        spikeTerminal = vscode.window.createTerminal('Pybricks SPIKE');
    }
    return spikeTerminal;
}

async function flashActiveSpikeFile() {
    const activeEditor = vscode.window.activeTextEditor;
    if (!activeEditor) {
        vscode.window.showErrorMessage('Keine Datei geöffnet! Bitte eine .py-Datei öffnen und dann ⬇️ SPIKE drücken.');
        return;
    }

    const mainPath = activeEditor.document.uri.fsPath;
    if (!mainPath.toLowerCase().endsWith('.py')) {
        vscode.window.showErrorMessage('Die aktive Datei ist keine Python-Datei! Bitte eine .py-Datei öffnen.');
        return;
    }

    const outputChannel = vscode.window.createOutputChannel('Pybricks SPIKE');
    outputChannel.clear();
    outputChannel.show(true);
    outputChannel.appendLine('🚀 Pybricks Upload gestartet...');
    outputChannel.appendLine(`📄 Programm: ${mainPath}`);
    outputChannel.appendLine('----------------------------------------');

    const statusItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
    statusItem.text = '$(sync~spin) Pybricks: Verbinde…';
    statusItem.show();

    try {
        // 1️⃣ Python finden
        statusItem.text = '$(sync~spin) Pybricks: Suche Python…';
        outputChannel.appendLine('🔍 Suche Python (>= 3.10)…');
        const pythonCmd = await resolvePython();
        if (!pythonCmd) {
            statusItem.text = '$(error) Pybricks: Kein Python gefunden!';
            outputChannel.appendLine('❌ Kein Python >= 3.10 gefunden.');
            outputChannel.appendLine('👉 Bitte Python 3.10+ von python.org installieren (Windows: „Add python to PATH“ anhaken), VS Code neu starten und erneut drücken.');
            vscode.window.showErrorMessage('Kein Python 3.10+ gefunden. Bitte Python installieren, dann erneut ⬇️ SPIKE drücken.');
            setTimeout(() => statusItem.hide(), 5000);
            return;
        }
        const pythonLabel = pythonCmd.join(' ');
        outputChannel.appendLine(`✅ Python gefunden: ${pythonLabel}`);

        // 2️⃣ pybricksdev sicherstellen (Auto-Install = Komplettpaket)
        statusItem.text = '$(sync~spin) Pybricks: Prüfe pybricksdev…';
        const ready = await ensurePybricks(pythonCmd, outputChannel);
        if (!ready) {
            statusItem.text = '$(error) Pybricks: Installation fehlt!';
            setTimeout(() => statusItem.hide(), 5000);
            return;
        }

        // 3️⃣ Verbinden + Flashen + Starten
        const args = [...pythonCmd.slice(1), '-m', 'pybricksdev', 'run', 'ble', mainPath];
        outputChannel.appendLine(`Befehl: ${pythonCmd[0]} ${args.join(' ')}`);
        outputChannel.appendLine('----------------------------------------');
        outputChannel.appendLine('🔗 Verbinde mit SPIKE (bitte Hub einschalten & Bluetooth an)…');

        const terminal = getOrCreateTerminal();
        terminal.show(true);
        terminal.sendText(`# Verbinde & starte: ${mainPath}`);
        terminal.sendText(`${pythonLabel} -m pybricksdev run ble "${mainPath}"`);

        statusItem.text = '$(sync~spin) Pybricks: Übertrage…';

        const child = spawn(pythonCmd[0], args, { windowsHide: true });

        child.stdout.on('data', (data) => {
            outputChannel.appendLine('----------------------------------------');
            logPybricksLine(outputChannel, data);
        });
        child.stderr.on('data', (data) => logPybricksLine(outputChannel, data));

        child.on('error', (err) => {
            outputChannel.appendLine(`❌ [Fehler] Prozess konnte nicht gestartet werden: ${err.message}`);
            statusItem.text = '$(error) Pybricks: Fehler beim Start!';
            setTimeout(() => statusItem.hide(), 5000);
        });

        child.on('close', (code) => {
            outputChannel.appendLine('----------------------------------------');
            if (code === 0) {
                outputChannel.appendLine('✅ Upload erfolgreich abgeschlossen! Programm läuft auf dem SPIKE.');
                statusItem.text = '$(check) Pybricks: Fertig!';
            } else {
                outputChannel.appendLine(`⚠️ Upload mit Exit-Code ${code} beendet.`);
                outputChannel.appendLine('Tipps: Hub eingeschaltet & nah dran? Anderes Programm belegt BLE? Erneut drücken.');
                statusItem.text = '$(error) Pybricks: Fehler beim Upload!';
            }
            setTimeout(() => statusItem.hide(), 5000);
            outputChannel.appendLine('----------------------------------------');
        });
    } catch (error) {
        outputChannel.appendLine(`❌ Unerwarteter Fehler: ${(error && error.message) || error}`);
        statusItem.text = '$(error) Pybricks: Fehler!';
        setTimeout(() => statusItem.hide(), 5000);
    }
}

function activate(context) {
    const disposable = vscode.commands.registerCommand(
        'robotik-extension.downloadMainSpike',
        flashActiveSpikeFile
    );
    context.subscriptions.push(disposable);

    // Pausiert für Marketplace v0.1 (kommen später zurück):
    // - runSimWin (tools/sim_win.py fehlt im Repo)
    // - downloadMainSpikeJulian (hartcodierter Absolutpfad, nur Dev-PC)
    // - downloadMainEsp (hängt von fremder Pymakr-Extension ab)
    // - syncOnSave für communication.py/utils.py
    // - Batterie-Dummy in der Statusbar
}

function deactivate() {
    if (spikeTerminal) {
        spikeTerminal.dispose();
    }
}

module.exports = {
    activate,
    deactivate,
    // für Tests exportiert
    _test: { parsePythonVersion, resolvePython }
};
