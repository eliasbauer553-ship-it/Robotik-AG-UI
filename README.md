# Robotik in VS Code

LEGO® SPIKE (Pybricks) per Knopfdruck flashen & starten – jetzt mit eigener **Seitenleiste** in der Activity Bar (Roboter-Symbol), für die Robotik-AG des LGÖ.

## First Steps

1. Extension installieren und auf das **Roboter-Symbol** in der linken Leiste klicken.
2. Voraussetzung (einmalig): **Python 3.10+** (Windows: von [python.org](https://www.python.org/downloads/), „Add python.exe to PATH“ anhaken; danach VS Code neu starten).
3. Hub mit **Pybricks-Firmware** einschalten, Bluetooth am Rechner an.
4. `.py`-Datei öffnen → in der Seitenleiste **▶ Hochladen & starten** (oder oben im Editor **⬇️ Spike**, Tastenkürzel `Strg+Alt+R` / `Cmd+Alt+R`).

Beim ersten Start richtet die Extension automatisch eine **eigene Python-Umgebung** mit `pybricksdev` ein (Internet nötig). Dein System-Python bleibt unberührt.

## Die Seitenleiste

| Bereich | Funktionen |
|---|---|
| **Hauptkarte** | aktive Datei, gewählter Hub, ▶ Hochladen & starten, ⬆ Nur hochladen, ■ Stop, **Fortschritt in Schritten** (Hub suchen → Verbunden → Übertragen → Läuft → Fertig) |
| **Hinweise** | Fehlermeldungen werden in verständliche Hilfe übersetzt (Hub nicht gefunden, Bluetooth aus, Hub schon verbunden, Firmware passt nicht, Fehler im Programm …) mit Reparatur-Knopf |
| **Hubs** | Bluetooth-Suche mit Signalstärke, Hub wählen/merken, **Verbindung testen**, Hub aus der Liste **löschen**, Name manuell eintragen, „Automatisch“ |
| **Live-Ausgabe** | farbiges Log; `print()`-Ausgaben des Hubs sind getrennt von Systemmeldungen |
| **Werkzeuge** | Programm aus Vorlage, **neues Projekt anlegen**, **Autovervollständigung einrichten**, **Programm vom Hub löschen**, Umgebung prüfen/reparieren, pybricksdev aktualisieren, Links zu Firmware & Doku |
| **Klassenmodus** | dieselbe Datei auf **mehrere Hubs** gleichzeitig (3 parallel), Status pro Hub, „nur hochladen“ oder „hochladen & starten“ |
| **Messwerte** | Zahlen aus `print("Abstand:", x)` erscheinen live als **Kurve** (hilfreich z. B. für Regler) |
| **Aufgaben** | Aufgabenkarten mit Ziel, Tipps und Startdatei – eigene Karten über `robotik-tasks.json` |
| **Verlauf** | letzte Uploads mit ↻ „erneut hochladen“ |
| **Einstellungen** | Datei vor Upload speichern, **Auto-Upload beim Speichern**, Log leeren |

Außerdem: Statusleiste (zeigt Hub & Zustand, Klick öffnet die Seitenleiste) und **Snippets** (`pb-start`, `pb-motor`, `pb-drive`, `pb-color`, `pb-ultra`, `pb-gyro`, `pb-button`, `pb-text`).

## Mehr Komfort beim Programmieren

- **Vorab-Prüfung:** Vor jedem Upload prüft die Erweiterung die Syntax und warnt vor typischen Fehlern (doppelt belegter Port, `time.sleep` statt `wait`, Module die es auf dem Hub nicht gibt). Bei einem Syntaxfehler wird nichts zum Hub gesendet.
- **Fehler im Editor:** Stürzt das Programm auf dem Hub ab, wird die Zeile aus dem Traceback rot markiert („Zur Zeile springen“).
- **Autovervollständigung:** Die Pybricks-Stubs werden mit der Umgebung installiert und in `python.analysis.extraPaths` eingetragen (benötigt die Erweiterung *Python*/Pylance von Microsoft).

### Eigene Aufgabenkarten (`robotik-tasks.json`)

```json
[
  {
    "title": "Slalom",
    "level": "Mittel",
    "goal": "Fahre um drei Hindernisse herum.",
    "hints": ["robot.curve(radius, winkel)"],
    "starter": "from pybricks.hubs import PrimeHub\n"
  }
]
```

## Befehle (Strg+Umschalt+P → „Robotik“)

`⬇️ Spike` · Nur hochladen · Klassenmodus · Programm stoppen · Nach Hubs suchen · Programm vom Hub löschen · Neues Programm aus Vorlage · Neues Projekt anlegen · Diagnosebericht kopieren · Autovervollständigung einrichten · Umgebung prüfen / reparieren · Steuerung öffnen

## Einstellungen

`robotik.pythonPath` · `robotik.saveBeforeRun` · `robotik.autoRunOnSave` · `robotik.clearLogOnRun` · `robotik.scanTimeout`

## Hinweise

- „Programm vom Hub löschen“ überschreibt das gespeicherte Hub-Programm mit einem leeren Programm.
- Ein Hub spricht immer nur mit **einem** Programm: Pybricks Code im Browser vorher trennen.
- Lizenz: GPL-3.0-only, siehe `LICENSE`.

## Entwicklung

`npm install` · `npm test` (Lint, Logik- und Simulationstests) · `npm run package` (erzeugt die `.vsix`).
