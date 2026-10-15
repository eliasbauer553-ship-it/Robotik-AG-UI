'use strict';

const HEAD = `from pybricks.hubs import PrimeHub
from pybricks.pupdevices import Motor, ColorSensor, UltrasonicSensor
from pybricks.parameters import Port, Direction, Color, Button, Stop
from pybricks.robotics import DriveBase
from pybricks.tools import wait, StopWatch
`;

const TEMPLATES = [
    {
        id: 'hello',
        label: 'Hallo Hub',
        detail: 'Licht, Display und Piepton – prüft, ob alles läuft',
        file: 'hallo_hub.py',
        code: `from pybricks.hubs import PrimeHub
from pybricks.parameters import Color
from pybricks.tools import wait

hub = PrimeHub()

hub.light.on(Color.GREEN)
hub.display.text("Hi")
hub.speaker.beep()
wait(1000)
print("Hallo vom SPIKE!")
`
    },
    {
        id: 'motor',
        label: 'Motor-Test',
        detail: 'Dreht einen Motor vor und zurück',
        file: 'motor_test.py',
        code: `${HEAD}
hub = PrimeHub()
motor = Motor(Port.A)  # <- Port anpassen

motor.run_angle(500, 360)    # 1 Umdrehung vorwärts
wait(300)
motor.run_angle(500, -360)   # 1 Umdrehung zurück
print("Winkel:", motor.angle())
`
    },
    {
        id: 'drive',
        label: 'Fahrbasis: Quadrat fahren',
        detail: 'DriveBase mit zwei Motoren – fährt ein Quadrat',
        file: 'quadrat.py',
        code: `${HEAD}
hub = PrimeHub()
left = Motor(Port.A, Direction.COUNTERCLOCKWISE)  # <- Ports anpassen
right = Motor(Port.B)
robot = DriveBase(left, right, wheel_diameter=56, axle_track=112)

for _ in range(4):
    robot.straight(300)  # mm
    robot.turn(90)       # Grad

robot.stop()
`
    },
    {
        id: 'sensors',
        label: 'Sensor-Monitor',
        detail: 'Gibt Farbe, Abstand und Drehwinkel fortlaufend aus',
        file: 'sensor_monitor.py',
        code: `${HEAD}
hub = PrimeHub()
color = ColorSensor(Port.C)        # <- Ports anpassen
eyes = UltrasonicSensor(Port.D)

hub.imu.reset_heading(0)

while Button.CENTER not in hub.buttons.pressed():
    print("Farbe:", color.color(), "| Abstand:", eyes.distance(), "mm | Winkel:", hub.imu.heading())
    wait(250)
`
    }
];

module.exports = { TEMPLATES };
