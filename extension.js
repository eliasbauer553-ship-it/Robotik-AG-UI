const path = require('path');
const vscode = require('vscode');
const { exec } = require('child_process');

function activate(context) {
    let disposable = vscode.commands.registerCommand('robotik-extension.runSimWin', function () {
        // Pfad zu deinem Python-Skript
        const extensionPath = context.extensionPath;
        const scriptPath = path.join(extensionPath, 'tools', 'sim_win.py');

        exec(`python "${scriptPath}"`, (error, stdout, stderr) => {
            if (error) {
                vscode.window.showErrorMessage(`Fehler: ${error.message}`);
                return;
            }
            if (stderr) {
                vscode.window.showErrorMessage(`Stderr: ${stderr}`);
                return;
            }
            vscode.window.showInformationMessage(`Output: ${stdout}`);
        });
    });

    context.subscriptions.push(disposable);

    // Statusbar-Item erstellen
    const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    statusBarItem.text = 'Akku: 8300 mV [100%] 🔋'; // Anzeige für Akku
    statusBarItem.tooltip = 'Zeigt den (genauen) Akku-Status des gerade verbundenen Spike an'; // Tooltip
    statusBarItem.command = 'robotik-extension.runSimWin'; // Optional: Klickbar machen
    statusBarItem.show();

    context.subscriptions.push(statusBarItem);

    const flashRunSpikeDisposable = vscode.commands.registerCommand('robotik-extension.downloadMainSpike', function () {
        const extensionPath = context.extensionPath;
        const venvPython = path.join(extensionPath, '..', '.venv', 'Scripts', 'python.exe');

        // Aktive Datei holen
        const activeEditor = vscode.window.activeTextEditor;

        if (!activeEditor) {
            vscode.window.showErrorMessage("Keine Datei geöffnet!");
            return;
        }

        const activeFilePath = activeEditor.document.uri.fsPath;

        // Prüfen ob es eine Python-Datei ist
        if (!activeFilePath.endsWith('.py')) {
            vscode.window.showErrorMessage("Die aktive Datei ist keine Python-Datei!");
            return;
        }

        const mainPath = activeFilePath;
        const command = `"${venvPython}" -m pybricksdev run ble "${mainPath}"`;

        // === 1️⃣ Output Panel vorbereiten ===
        const outputChannel = vscode.window.createOutputChannel("Pybricks Upload");
        outputChannel.clear();
        outputChannel.show(true);
        outputChannel.appendLine("🚀 Pybricks Upload gestartet...");
        outputChannel.appendLine(`Befehl: ${command}`);
        outputChannel.appendLine("----------------------------------------");

        // === 2️⃣ Statusleiste anzeigen ===
        const statusItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
        statusItem.text = "$(sync~spin) Pybricks: Übertrage…";
        statusItem.show();

        // === 3️⃣ Wiederverwendbares Terminal (nicht jedes Mal neu öffnen) ===
        if (!globalThis.spikeTerminal || globalThis.spikeTerminal.exitStatus !== undefined) {
            globalThis.spikeTerminal = vscode.window.createTerminal("Pybricks Terminal");
        }
        globalThis.spikeTerminal.show(true);
        globalThis.spikeTerminal.sendText(`# ${venvPython} -m pybricksdev run ble ${mainPath}`);
        //globalThis.spikeTerminal.sendText(command);

        // === 4️⃣ Paralleles Logging mit `exec` ===
        const child = exec(command);

        child.stdout.on('data', (data) => {
            outputChannel.appendLine("----------------------------------------");
            outputChannel.appendLine(`${data.trimEnd()}`);
        });

        child.stderr.on('data', (data) => {
            const text = data.trimEnd();
            if (text.toLowerCase().includes('error')) {
                outputChannel.appendLine(`❌ [Fehler] ${text}`);
            } else if (text.toLowerCase().includes('connecting')) {
                outputChannel.appendLine(`🔗 [Verbinde] ${text}`);
            } else if (text.toLowerCase().includes('uploading')) {
                outputChannel.appendLine(`⬆️ [Übertrage] ${text}`);
            } else if (text.toLowerCase().includes('done') || text.toLowerCase().includes('complete')) {
                outputChannel.appendLine(`✅ [Fertig] ${text}`);
            } else {
                outputChannel.appendLine(`${text}`);
            }
        });

        child.on('close', (code) => {
            outputChannel.appendLine("----------------------------------------");
            if (code === 0) {
                outputChannel.appendLine("✅ Upload erfolgreich abgeschlossen!");
                statusItem.text = "$(check) Pybricks: Fertig!";
            } else {
                outputChannel.appendLine(`⚠️ Upload mit Exit-Code ${code} beendet.`);
                statusItem.text = "$(error) Pybricks: Fehler beim Upload!";
            }

            // Nach 4 Sekunden Statusleiste wieder ausblenden
            setTimeout(() => statusItem.hide(), 4000);
            outputChannel.appendLine("----------------------------------------");
        });
    });

    context.subscriptions.push(flashRunSpikeDisposable);


    const flashRunSpikeDisposableJulian = vscode.commands.registerCommand('robotik-extension.downloadMainSpikeJulian', function () {
        const extensionPath = path.join('C:', 'Users', 'julia', 'OneDrive', 'WRO', 'VS_Code_fuer_Robotik', 'robotik-extension');
        const venvPython = path.join(extensionPath, '..', '.venv', 'Scripts', 'python.exe');
        const mainPath = path.join(extensionPath, '..', 'Programms', 'spike', 'main.py');
        const command = `"${venvPython}" -m pybricksdev run ble "${mainPath}"`;

        // === 1️⃣ Output Panel vorbereiten ===
        const outputChannel = vscode.window.createOutputChannel("Pybricks Upload");
        outputChannel.clear();
        outputChannel.show(true);
        outputChannel.appendLine("🚀 Pybricks Upload gestartet...");
        outputChannel.appendLine(`Befehl: ${command}`);
        outputChannel.appendLine("----------------------------------------");

        // === 2️⃣ Statusleiste anzeigen ===
        const statusItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
        statusItem.text = "$(sync~spin) Pybricks: Übertrage…";
        statusItem.show();

        // === 3️⃣ Wiederverwendbares Terminal (nicht jedes Mal neu öffnen) ===
        if (!globalThis.spikeTerminal || globalThis.spikeTerminal.exitStatus !== undefined) {
            globalThis.spikeTerminal = vscode.window.createTerminal("Pybricks Terminal");
        }
        globalThis.spikeTerminal.show(true);
        globalThis.spikeTerminal.sendText(`# ${venvPython} -m pybricksdev run ble ${mainPath}`);
        //globalThis.spikeTerminal.sendText(command);

        // === 4️⃣ Paralleles Logging mit `exec` ===
        const child = exec(command);

        child.stdout.on('data', (data) => {
            outputChannel.appendLine("----------------------------------------");
            outputChannel.appendLine(`${data.trimEnd()}`);
        });

        child.stderr.on('data', (data) => {
            const text = data.trimEnd();
            if (text.toLowerCase().includes('error')) {
                outputChannel.appendLine(`❌ [Fehler] ${text}`);
            } else if (text.toLowerCase().includes('connecting')) {
                outputChannel.appendLine(`🔗 [Verbinde] ${text}`);
            } else if (text.toLowerCase().includes('uploading')) {
                outputChannel.appendLine(`⬆️ [Übertrage] ${text}`);
            } else if (text.toLowerCase().includes('done') || text.toLowerCase().includes('complete')) {
                outputChannel.appendLine(`✅ [Fertig] ${text}`);
            } else {
                outputChannel.appendLine(`${text}`);
            }
        });

        child.on('close', (code) => {
            outputChannel.appendLine("----------------------------------------");
            if (code === 0) {
                outputChannel.appendLine("✅ Upload erfolgreich abgeschlossen!");
                statusItem.text = "$(check) Pybricks: Fertig!";
            } else {
                outputChannel.appendLine(`⚠️ Upload mit Exit-Code ${code} beendet.`);
                statusItem.text = "$(error) Pybricks: Fehler beim Upload!";
            }

            // Nach 4 Sekunden Statusleiste wieder ausblenden
            setTimeout(() => statusItem.hide(), 4000);
            outputChannel.appendLine("----------------------------------------");
        });
    });

    context.subscriptions.push(flashRunSpikeDisposableJulian);

    
    let flashRunEspDisposable = vscode.commands.registerCommand('robotik-extension.downloadMainEsp', async function () {
        try {
            vscode.window.showInformationMessage("🔄 ESP32 Upload-Prozess gestartet...");

            // 1️⃣ Verbindung sicherstellen
            await vscode.commands.executeCommand('pymakr.listDevices');
            await vscode.commands.executeCommand('pymakr.connect');
            vscode.window.showInformationMessage("🔗 Verbindung zum ESP32 hergestellt.");

            // 2️⃣ Laufendes Script stoppen (nur wenn Gerät verbunden)
            try {
                await vscode.commands.executeCommand('pymakr.stopScript');
                vscode.window.showInformationMessage("⏹️ Laufendes Script gestoppt.");
            } catch {
                vscode.window.showWarningMessage("⚠️ Kein laufendes Script gefunden – übersprungen.");
            }

            // 3️⃣ Terminal sicherstellen (öffnet eins, falls keins existiert)
            await vscode.commands.executeCommand('pymakr.createTerminalPrompt');
            vscode.window.showInformationMessage("💻 Terminal bereit.");

            // 4️⃣ esp32-Ordner hochladen
            const extensionPath = vscode.extensions.getExtension('deinname.robotik-extension')?.extensionPath;
            const esp32Path = path.join(extensionPath, '..', 'Programms', 'esp32');
            vscode.window.showInformationMessage("⬆️ Lade Projekt hoch...");

            await vscode.commands.executeCommand('pymakr.uploadPrompt');
            vscode.window.showInformationMessage("✅ Projekt erfolgreich hochgeladen.");

            // 5️⃣ Gerät neustarten
            await vscode.commands.executeCommand('pymakr.resetDevice');
            vscode.window.showInformationMessage("♻️ Gerät neu gestartet.");

            // 6️⃣ main.py starten
            await vscode.commands.executeCommand('pymakr.runFile');
            vscode.window.showInformationMessage("🚀 main.py gestartet.");

        } catch (error) {
            vscode.window.showErrorMessage(`❌ ESP32 Sync-Fehler: ${error.message}`);
            console.error(error);
        }
    });

    context.subscriptions.push(flashRunEspDisposable);


    // Auto-Sync wenn bestimmte Dateien gespeichert werden
    let syncOnSave = vscode.workspace.onDidSaveTextDocument((document) => {
        // Prüfen, ob es die zentrale Datei ist
        if (document.fileName.endsWith("communication.py")) {
            const extensionPath = context.extensionPath;
            const scriptPath = path.join(extensionPath, 'tools', 'sync_com.py');

            exec(`python "${scriptPath}"`, (error, stdout, stderr) => {
                if (error) {
                    vscode.window.showErrorMessage(`Sync-Fehler: ${error.message}`);
                    return;
                }
                if (stderr) {
                    vscode.window.showErrorMessage(`Sync-Stderr: ${stderr}`);
                    return;
                }
                vscode.window.showInformationMessage(`Bibliothek synchronisiert: ${stdout}`);
            });
        } else if (document.fileName.endsWith("utils.py")) {
            const extensionPath = context.extensionPath;
            const scriptPath = path.join(extensionPath, 'tools', 'sync_utils.py');

            exec(`python "${scriptPath}"`, (error, stdout, stderr) => {
                if (error) {
                    vscode.window.showErrorMessage(`Sync-Fehler: ${error.message}`);
                    return;
                }
                if (stderr) {
                    vscode.window.showErrorMessage(`Sync-Stderr: ${stderr}`);
                    return;
                }
                vscode.window.showInformationMessage(`Bibliothek synchronisiert: ${stdout}`);
            });
        }
    });

    context.subscriptions.push(syncOnSave);
}

function deactivate() {}

module.exports = {
    activate,
    deactivate
};
