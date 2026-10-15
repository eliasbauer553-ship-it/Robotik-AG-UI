'use strict';
// Übersetzt kryptische Fehlermeldungen in verständliche Hinweise für Schüler:innen.

const RULES = [
    {
        id: 'env-missing',
        re: /no module named ['"]?(bleak|pybricksdev|pybricks)|modulenotfounderror/i,
        title: 'Python-Umgebung unvollständig',
        text: 'pybricksdev (oder ein Teil davon) fehlt.',
        steps: ['Unten bei „Werkzeuge“ auf „Umgebung prüfen / reparieren“ klicken.'],
        action: { label: 'Umgebung reparieren', type: 'checkEnv' }
    },
    {
        id: 'bt-off',
        re: /bluetooth.*(off|disabled|turned off|unavailable|not available|powered)|no bluetooth adapter|adapter.*not (found|available)|radio.*off/i,
        title: 'Bluetooth ist nicht verfügbar',
        text: 'Der Rechner kann gerade kein Bluetooth benutzen.',
        steps: ['Bluetooth in den Systemeinstellungen einschalten.', 'Flugmodus ausschalten.', 'Danach erneut starten.']
    },
    {
        id: 'permission',
        re: /not authorized|authorization|permission denied|access denied|tcc|privacy/i,
        title: 'Bluetooth-Berechtigung fehlt',
        text: 'Das Betriebssystem hat VS Code den Bluetooth-Zugriff verweigert.',
        steps: ['macOS: Systemeinstellungen → Datenschutz & Sicherheit → Bluetooth → VS Code erlauben.', 'Linux: Nutzer muss Bluetooth verwenden dürfen (bluetoothd läuft?).', 'VS Code danach neu starten.']
    },
    {
        id: 'busy',
        re: /already connected|resource busy|device or resource busy|in ?progress|disconnected unexpectedly|connection (lost|closed)|not connected/i,
        title: 'Hub ist bereits verbunden',
        text: 'Ein Hub kann immer nur mit einem Programm gleichzeitig sprechen.',
        steps: ['Code.Pybricks.com im Browser: dort „Trennen“ klicken.', 'Anderes VS-Code-Fenster mit laufendem Upload schließen.', 'Hub einmal aus- und wieder einschalten.']
    },
    {
        id: 'no-hub',
        re: /no pybricks hub|no hub found|could not find|did not find|not found|no devices? found|timed? ?out|timeout/i,
        title: 'Kein Hub gefunden',
        text: 'Die Suche per Bluetooth war erfolglos.',
        steps: ['Hub einschalten (Bluetooth-Licht blinkt blau).', 'Hub nahe an den Rechner legen.', 'Läuft auf dem Hub die Pybricks-Firmware? (Original-LEGO-Firmware geht nicht.)', 'Stimmt der gewählte Hub-Name? Im Bereich „Hubs“ erneut suchen.']
    },
    {
        id: 'mpy',
        re: /mpy|bytecode|incompatible|unsupported (mpy )?version|invalid (mpy|header)/i,
        title: 'Firmware passt nicht zu pybricksdev',
        text: 'Hub-Firmware und pybricksdev sind unterschiedlich alt.',
        steps: ['pybricksdev aktualisieren (Werkzeuge → „pybricksdev aktualisieren“).', 'Falls es bleibt: Hub-Firmware auf code.pybricks.com aktualisieren.'],
        action: { label: 'pybricksdev aktualisieren', type: 'updateEnv' }
    },
    {
        id: 'memory',
        re: /memoryerror|out of memory|enomem|too large|program too big/i,
        title: 'Programm zu groß / Speicher voll',
        text: 'Der Hub hat zu wenig Speicher für dieses Programm.',
        steps: ['Unnötige Imports und große Listen entfernen.', 'Programm in kleinere Teile aufteilen.']
    },
    {
        id: 'py-syntax',
        re: /syntaxerror|indentationerror|nameerror|attributeerror|typeerror|valueerror|oserror|importerror/i,
        title: 'Fehler im Programm',
        text: 'Dein Python-Code enthält einen Fehler – die Zeilennummer steht im Log.',
        steps: ['Im Live-Log die letzte „Traceback“-Meldung lesen.', 'Meldung „ENODEV“ / „ENOENT“ heißt meist: Motor/Sensor am falschen Port angeschlossen.']
    }
];

/** @returns {{id:string,title:string,text:string,steps:string[],action?:{label:string,type:string}}|null} */
function analyze(text) {
    const t = String(text || '');
    if (!t.trim()) {
        return null;
    }
    for (const r of RULES) {
        if (r.re.test(t)) {
            return { id: r.id, title: r.title, text: r.text, steps: r.steps, action: r.action };
        }
    }
    return null;
}

module.exports = { analyze, RULES };
