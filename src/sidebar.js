'use strict';
const vscode = require('vscode');
const crypto = require('crypto');

class SidebarProvider {
    /**
     * @param {vscode.Uri} extensionUri
     * @param {{onMessage:(m:any)=>void, onReady:()=>void}} controller
     */
    constructor(extensionUri, controller) {
        this.extensionUri = extensionUri;
        this.controller = controller;
        /** @type {vscode.WebviewView|undefined} */
        this.view = undefined;
    }

    resolveWebviewView(view) {
        this.view = view;
        view.webview.options = {
            enableScripts: true,
            localResourceRoots: [vscode.Uri.joinPath(this.extensionUri, 'media')]
        };
        view.webview.html = this._html(view.webview);
        view.webview.onDidReceiveMessage((m) => {
            if (m && m.type === 'ready') {
                this.controller.onReady();
            } else {
                this.controller.onMessage(m);
            }
        });
        view.onDidDispose(() => {
            if (this.view === view) {
                this.view = undefined;
            }
        });
    }

    post(msg) {
        if (this.view) {
            this.view.webview.postMessage(msg);
        }
    }

    _html(webview) {
        const nonce = crypto.randomBytes(16).toString('base64');
        const media = (f) => webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, 'media', f));
        const csp = [
            "default-src 'none'",
            `style-src ${webview.cspSource}`,
            `script-src 'nonce-${nonce}'`,
            `img-src ${webview.cspSource} data:`
        ].join('; ');
        return `<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="${csp}">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<link rel="stylesheet" href="${media('sidebar.css')}">
<title>Robotik</title>
</head>
<body>
<header class="top">
  <div class="brand">
    <svg class="logo" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 6V3.5"/><circle cx="12" cy="2.7" r="1" fill="currentColor"/><rect x="4" y="6" width="16" height="13" rx="3.2"/><circle cx="9" cy="12" r="1.7" fill="currentColor" stroke="none"/><circle cx="15" cy="12" r="1.7" fill="currentColor" stroke="none"/><path d="M9.2 16h5.6"/><path d="M2 10.5v4.5M22 10.5v4.5"/></svg>
    <div><h1>Robotik</h1><span class="sub">LEGO SPIKE · Pybricks</span></div>
  </div>
  <div id="envPill" class="pill">…</div>
</header>

<section class="card" id="mainCard">
  <div class="row"><span class="label">Datei</span><span id="fileName" class="value">–</span><button class="mini" data-act="pickFile" title="Andere .py-Datei wählen">Ändern</button></div>
  <div class="row"><span class="label">Hub</span><span id="hubName" class="value">Auto</span></div>
  <button id="btnRun" class="primary" data-act="run">▶ Hochladen &amp; starten</button>
  <div class="btn-row">
    <button id="btnUpload" class="secondary" data-act="upload">⬆ Nur hochladen</button>
    <button id="btnStop" class="danger" data-act="stop">■ Stop</button>
  </div>
  <ol id="steps" class="steps" aria-live="polite"></ol>
  <div id="hint" class="hint hidden"></div>
</section>

<details open class="block">
  <summary>Hubs</summary>
  <div class="btn-row">
    <button id="btnScan" class="secondary" data-act="scan">🔍 Suchen</button>
    <button class="secondary" data-act="addHub">＋ Name eingeben</button>
  </div>
  <div id="hubs" class="hubs"></div>
</details>

<details open class="block">
  <summary>Live-Ausgabe</summary>
  <div class="btn-row"><button class="mini" data-act="clearLog">Leeren</button><button class="mini" data-act="openOutput">Output-Panel</button></div>
  <div id="log" class="log" role="log"></div>
</details>

<details class="block">
  <summary>Werkzeuge</summary>
  <div class="tools">
    <button class="secondary" data-act="newFromTemplate">📄 Neues Programm aus Vorlage</button>
    <button class="secondary" data-act="clearProgram">🗑 Programm vom Hub löschen</button>
    <button class="secondary" data-act="checkEnv">🩺 Umgebung prüfen / reparieren</button>
    <button class="secondary" data-act="updateEnv">⬆ pybricksdev aktualisieren</button>
    <button class="secondary" data-act="link" data-value="https://code.pybricks.com">🌐 Firmware installieren (code.pybricks.com)</button>
    <button class="secondary" data-act="link" data-value="https://docs.pybricks.com">📚 Pybricks-Dokumentation</button>
  </div>
</details>

<details class="block">
  <summary>Verlauf</summary>
  <div id="history" class="history"></div>
</details>

<details class="block">
  <summary>Einstellungen</summary>
  <label class="check"><input type="checkbox" data-setting="saveBeforeRun"> Datei vor dem Upload speichern</label>
  <label class="check"><input type="checkbox" data-setting="autoRunOnSave"> Beim Speichern automatisch hochladen &amp; starten</label>
  <label class="check"><input type="checkbox" data-setting="clearLogOnRun"> Log vor jedem Start leeren</label>
</details>

<script nonce="${nonce}" src="${media('sidebar.js')}"></script>
</body>
</html>`;
    }
}

module.exports = { SidebarProvider };
