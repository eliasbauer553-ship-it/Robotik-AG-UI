'use strict';
// Einfache statische Prüfungen vor dem Upload (typische Anfängerfehler).

const DEVICE_RE = /\b(Motor|ColorSensor|UltrasonicSensor|ForceSensor|ColorDistanceSensor|InfraredSensor|TiltSensor|PFMotor|DCMotor|Remote)\s*\(\s*Port\.([A-F])/;

/** @returns {{line:number, message:string, severity:'warning'|'info'}[]} line 1-basiert */
function staticChecks(text) {
    const res = [];
    const lines = String(text).split(/\r?\n/);
    if (!/^\s*(from|import)\s+pybricks/m.test(text)) {
        res.push({ line: 1, message: 'Kein „from pybricks…“-Import gefunden – so läuft das Programm nicht auf dem Hub.', severity: 'info' });
    }
    const ports = new Map();
    lines.forEach((ln, i) => {
        const code = ln.split('#')[0];
        const m = DEVICE_RE.exec(code);
        if (m) {
            const port = m[2];
            if (ports.has(port)) {
                res.push({ line: i + 1, message: `Port ${port} ist schon in Zeile ${ports.get(port)} belegt – zwei Geräte am selben Port gehen nicht.`, severity: 'warning' });
            } else {
                ports.set(port, i + 1);
            }
        }
        if (/\btime\.sleep\s*\(/.test(code)) {
            res.push({ line: i + 1, message: 'Auf dem Hub besser wait(Millisekunden) aus pybricks.tools verwenden.', severity: 'warning' });
        }
        if (/^\s*import\s+(numpy|pandas|requests|tkinter)\b/.test(code)) {
            res.push({ line: i + 1, message: 'Dieses Modul gibt es auf dem Hub nicht (MicroPython).', severity: 'warning' });
        }
    });
    return res;
}

module.exports = { staticChecks };
