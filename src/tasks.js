'use strict';
const fs = require('fs');
const path = require('path');

const BUILTIN = [
    {
        id: 'b1', title: 'Erste Lichtshow', level: 'Einstieg',
        goal: 'Das Hub-Licht soll nacheinander grün, gelb und rot leuchten – je 1 Sekunde.',
        hints: ['hub.light.on(Color.GREEN)', 'wait(1000) wartet 1000 Millisekunden', 'Color.YELLOW, Color.RED'],
        starter: 'from pybricks.hubs import PrimeHub\nfrom pybricks.parameters import Color\nfrom pybricks.tools import wait\n\nhub = PrimeHub()\n\n# Deine Lichtshow:\n'
    },
    {
        id: 'b2', title: 'Motor präzise drehen', level: 'Einstieg',
        goal: 'Ein Motor dreht genau eine halbe Umdrehung vor, wartet 1 s und dreht zurück.',
        hints: ['motor.run_angle(Geschwindigkeit, Winkel)', 'Eine Umdrehung = 360 Grad', 'Negativer Winkel = Gegenrichtung'],
        starter: 'from pybricks.pupdevices import Motor\nfrom pybricks.parameters import Port\nfrom pybricks.tools import wait\n\nmotor = Motor(Port.A)  # Port anpassen\n\n# Dein Code:\n'
    },
    {
        id: 'b3', title: 'Quadrat fahren', level: 'Mittel',
        goal: 'Der Roboter fährt ein Quadrat mit 30 cm Kantenlänge und endet wieder am Start.',
        hints: ['DriveBase(left, right, wheel_diameter=56, axle_track=112)', 'robot.straight(300) fährt 300 mm', 'robot.turn(90) dreht um 90 Grad', 'for _ in range(4): wiederholt vier Mal'],
        starter: 'from pybricks.pupdevices import Motor\nfrom pybricks.parameters import Port, Direction\nfrom pybricks.robotics import DriveBase\n\nleft = Motor(Port.A, Direction.COUNTERCLOCKWISE)\nright = Motor(Port.B)\nrobot = DriveBase(left, right, wheel_diameter=56, axle_track=112)\n\n# Dein Code:\n'
    },
    {
        id: 'b4', title: 'Hindernis erkennen', level: 'Mittel',
        goal: 'Der Roboter fährt geradeaus und bleibt stehen, sobald ein Hindernis näher als 15 cm ist.',
        hints: ['UltrasonicSensor(Port.D).distance() liefert mm', 'robot.drive(Geschwindigkeit, 0) fährt dauerhaft', 'while-Schleife mit Bedingung, robot.stop() am Ende'],
        starter: 'from pybricks.pupdevices import Motor, UltrasonicSensor\nfrom pybricks.parameters import Port, Direction\nfrom pybricks.robotics import DriveBase\nfrom pybricks.tools import wait\n\nleft = Motor(Port.A, Direction.COUNTERCLOCKWISE)\nright = Motor(Port.B)\nrobot = DriveBase(left, right, wheel_diameter=56, axle_track=112)\neyes = UltrasonicSensor(Port.D)\n\n# Dein Code:\n'
    },
    {
        id: 'b5', title: 'Linie folgen (P-Regler)', level: 'Fortgeschritten',
        goal: 'Der Roboter folgt dem Rand einer schwarzen Linie. Tipp: Kurvenstärke proportional zum Messfehler.',
        hints: ['reflection = sensor.reflection()', 'fehler = reflection - schwelle', 'robot.drive(100, fehler * faktor)', 'Werte als print("Licht:", reflection) ausgeben – die Seitenleiste zeichnet sie als Kurve'],
        starter: 'from pybricks.pupdevices import Motor, ColorSensor\nfrom pybricks.parameters import Port, Direction\nfrom pybricks.robotics import DriveBase\nfrom pybricks.tools import wait\n\nleft = Motor(Port.A, Direction.COUNTERCLOCKWISE)\nright = Motor(Port.B)\nrobot = DriveBase(left, right, wheel_diameter=56, axle_track=112)\nsensor = ColorSensor(Port.C)\n\nSCHWELLE = 50\nFAKTOR = 1.2\n\n# Dein Code:\n'
    }
];

/** Eingebaute Karten + optionale Datei `robotik-tasks.json` im Workspace-Ordner. */
function loadTasks(workspaceRoot) {
    const tasks = BUILTIN.map((t) => ({ ...t, custom: false }));
    if (workspaceRoot) {
        try {
            const file = path.join(workspaceRoot, 'robotik-tasks.json');
            if (fs.existsSync(file)) {
                const data = JSON.parse(fs.readFileSync(file, 'utf8'));
                if (Array.isArray(data)) {
                    data.forEach((t, i) => {
                        if (t && typeof t.title === 'string') {
                            tasks.push({
                                id: `c${i}`,
                                title: t.title,
                                level: typeof t.level === 'string' ? t.level : 'Eigene',
                                goal: typeof t.goal === 'string' ? t.goal : '',
                                hints: Array.isArray(t.hints) ? t.hints.filter((h) => typeof h === 'string') : [],
                                starter: typeof t.starter === 'string' ? t.starter : '',
                                custom: true
                            });
                        }
                    });
                }
            }
        } catch {
            // kaputte JSON-Datei ignorieren
        }
    }
    return tasks;
}

module.exports = { BUILTIN, loadTasks };
