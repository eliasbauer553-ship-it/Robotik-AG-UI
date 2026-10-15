'use strict';
// Reine Hilfsfunktionen ohne VS-Code-Abhängigkeit (einzeln testbar).

/** Schritte der Fortschrittsanzeige. */
const STEP = { ENV: 0, SEARCH: 1, CONNECTED: 2, TRANSFER: 3, RUNNING: 4, DONE: 5 };

/** Teilt Stream-Chunks in Zeilen (\n, \r\n und \r für Fortschrittsbalken). */
class LineBuffer {
    constructor(onLine) {
        this.buf = '';
        this.onLine = onLine;
    }
    push(chunk) {
        this.buf += chunk.toString('utf8');
        const parts = this.buf.split(/\r\n|\n|\r/);
        this.buf = parts.pop();
        for (const p of parts) {
            if (p.trim()) {
                this.onLine(p);
            }
        }
    }
    flush() {
        if (this.buf.trim()) {
            this.onLine(this.buf);
        }
        this.buf = '';
    }
}

/**
 * Ordnet eine Ausgabezeile von pybricksdev einer Kategorie und einem Schritt zu.
 * @param {string} raw Zeile
 * @param {number} currentStep aktueller Schritt (ab RUNNING gilt fast alles als Hub-Ausgabe)
 * @returns {{kind:'error'|'step'|'hub'|'info', step:number|null, pct?:number}|null}
 */
function classifyLine(raw, currentStep) {
    const line = String(raw).trim();
    if (!line) {
        return null;
    }
    const l = line.toLowerCase();
    const pctMatch = /(\d{1,3})\s?%/.exec(l);

    if (/^traceback|^\w*error\b|exception|failed|timed out|timeout/.test(l) && (currentStep < STEP.RUNNING || /^traceback/.test(l))) {
        return { kind: 'error', step: null };
    }
    if (currentStep >= STEP.RUNNING) {
        return { kind: 'hub', step: null };
    }
    if (/disconnect/.test(l)) {
        return { kind: 'info', step: null };
    }
    if (/search|scan|discover|looking for/.test(l)) {
        return { kind: 'step', step: STEP.SEARCH };
    }
    if (/connecting/.test(l)) {
        return { kind: 'step', step: STEP.SEARCH };
    }
    if (/connected|connection established/.test(l)) {
        return { kind: 'step', step: STEP.CONNECTED };
    }
    if (pctMatch || /compil|upload|download|sending|transfer|loading|bytes|program size/.test(l)) {
        return { kind: 'step', step: STEP.TRANSFER, pct: pctMatch ? Number(pctMatch[1]) : undefined };
    }
    if (/start(ing|ed)? (the )?(user )?program|running/.test(l)) {
        return { kind: 'step', step: STEP.RUNNING };
    }
    return currentStep >= STEP.CONNECTED ? { kind: 'hub', step: null } : { kind: 'info', step: null };
}

/** Findet das letzte JSON-Objekt/-Array in einer Python-Ausgabe. */
function parseLastJson(stdout) {
    const lines = String(stdout).split(/\r?\n/).map((s) => s.trim()).filter(Boolean);
    for (let i = lines.length - 1; i >= 0; i--) {
        if (lines[i].startsWith('{') || lines[i].startsWith('[')) {
            try {
                return JSON.parse(lines[i]);
            } catch {
                // weiter nach oben suchen
            }
        }
    }
    return null;
}

function parsePythonVersion(text) {
    const m = /Python\s+(\d+)\.(\d+)\.(\d+)/i.exec(text || '');
    return m ? { major: Number(m[1]), minor: Number(m[2]), patch: Number(m[3]) } : null;
}

/** Wandelt RSSI (dBm) in 1–4 Balken um. */
function rssiBars(rssi) {
    if (typeof rssi !== 'number') {
        return 0;
    }
    if (rssi >= -60) { return 4; }
    if (rssi >= -70) { return 3; }
    if (rssi >= -80) { return 2; }
    return 1;
}

module.exports = { STEP, LineBuffer, classifyLine, parseLastJson, parsePythonVersion, rssiBars };
