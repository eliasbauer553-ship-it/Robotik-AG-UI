'use strict';
// Erkennt Messwerte in print()-Ausgaben des Hubs ("Abstand: 120", "a=1 b=2" oder "1, 2, 3").

function parseValues(line) {
    const out = {};
    const re = /([A-Za-zÄÖÜäöüß_][A-Za-zÄÖÜäöüß_0-9 ]*?)\s*[:=]\s*(-?\d+(?:[.,]\d+)?)(?![\w.])/g;
    let m;
    while ((m = re.exec(line)) !== null) {
        out[m[1].trim()] = parseFloat(m[2].replace(',', '.'));
    }
    if (!Object.keys(out).length) {
        const parts = String(line).trim().split(/[\s,;]+/);
        if (parts.length > 0 && parts.length <= 6 && parts.every((p) => /^-?\d+(?:[.,]\d+)?$/.test(p))) {
            parts.forEach((p, i) => { out[`Wert ${i + 1}`] = parseFloat(p.replace(',', '.')); });
        }
    }
    return out;
}

module.exports = { parseValues };
