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
| **Werkzeuge** | Programm aus Vorlage anlegen, **Programm vom Hub löschen**, Umgebung prüfen/reparieren, pybricksdev aktualisieren, Links zu Firmware & Doku |
| **Verlauf** | letzte Uploads mit ↻ „erneut hochladen“ |
| **Einstellungen** | Datei vor Upload speichern, **Auto-Upload beim Speichern**, Log leeren |

Außerdem: Statusleiste (zeigt Hub & Zustand, Klick öffnet die Seitenleiste) und **Snippets** (`pb-start`, `pb-motor`, `pb-drive`, `pb-color`, `pb-ultra`, `pb-gyro`, `pb-button`, `pb-text`).

## Befehle (Strg+Umschalt+P → „Robotik“)

`⬇️ Spike` · Nur hochladen · Programm stoppen · Nach Hubs suchen · Programm vom Hub löschen · Neues Programm aus Vorlage · Umgebung prüfen / reparieren · Steuerung öffnen

## Einstellungen

`robotik.pythonPath` · `robotik.saveBeforeRun` · `robotik.autoRunOnSave` · `robotik.clearLogOnRun` · `robotik.scanTimeout`

## Hinweise

- „Programm vom Hub löschen“ überschreibt das gespeicherte Hub-Programm mit einem leeren Programm.
- Ein Hub spricht immer nur mit **einem** Programm: Pybricks Code im Browser vorher trennen.
- Lizenz: GPL-3.0-only, siehe `LICENSE`.
