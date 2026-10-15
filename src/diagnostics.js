'use strict';
// Sucht in Hub-/pybricksdev-Ausgaben nach der Fehlerstelle eines Python-Tracebacks.

/** @returns {{line:number, message:string}|null} line ist 1-basiert */
function findErrorLocation(lines) {
    let loc = null;
    let message = null;
    for (const raw of lines) {
        const l = String(raw);
        const m = /File "([^"]*)", line (\d+)/.exec(l);
        if (m) {
            const f = m[1];
            // Bibliotheks-Frames (pybricks/…) überspringen
            if (!/pybricks[\\/]|site-packages|^<frozen/i.test(f)) {
                loc = Number(m[2]);
            }
            continue;
        }
        const e = /^\s*([A-Za-z_][\w.]*(?:Error|Exception|Interrupt))\b:?\s*(.*)$/.exec(l);
        if (e && loc !== null) {
            message = e[2] ? `${e[1]}: ${e[2]}` : e[1];
        }
    }
    return loc !== null ? { line: loc, message: message || 'Fehler im Programm' } : null;
}

module.exports = { findErrorLocation };
