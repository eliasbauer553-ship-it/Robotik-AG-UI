# Robotik in VS Code

LEGO® SPIKE per Knopfdruck flashen & starten – für die Robotik-AG.

## So geht's (für Freunde: einfach installieren & los)

1. Extension aus dem Marketplace installieren: **Robotik in VS Code** (`JulianSeckinger.robotik-extension`).
2. Voraussetzung (einmalig): **Python 3.10+** installieren
   - Windows: von [python.org](https://www.python.org/downloads/) laden, dabei **„Add python.exe to PATH“ anhaken**.
   - Mac/Linux: `python3 --version` prüfen (>= 3.10).
   - VS Code nach der Python-Installation neu starten.
3. `.py`-Datei öffnen (z. B. `main.py` für den SPIKE).
4. Oben im Editor auf **Spike** klicken (oder Command Palette: `Spike`).
5. Beim ersten Klick installiert die Extension automatisch `pybricksdev` per `pip` nach (Internet nötig).
6. SPIKE-Hub **einschalten**, Bluetooth am Rechner **an**, Hub **nah dran** → die Extension verbindet sich per BLE, überträgt das aktive Programm und startet es.

Fortschritt siehst du im Output-Panel **„Pybricks SPIKE“** und in der Statusleiste.

## Was du brauchst

- VS Code 1.103+
- Python 3.10+
- Internet beim ersten Start (für `pip install pybricksdev`)
- LEGO SPIKE Prime mit Pybricks-Firmware + eingeschaltetem Bluetooth

## Befehle

| Befehl | Was passiert |
|---|---|
| `Spike` (`robotik-extension.downloadMainSpike`) | Nimmt die gerade geöffnete `.py`-Datei und führt `python -m pybricksdev run ble <datei>` aus: verbinden → übertragen → starten. |

## Fehlerbehebung

- **„Kein Python gefunden“** → Python 3.10+ installieren, PATH-Haken setzen, VS Code neu starten.
- **„pybricksdev konnte nicht installiert werden“** → manuell: `python -m pip install -U pybricksdev` (Windows) bzw. `python3 -m pip install -U pybricksdev` (Mac/Linux).
- **BLE findet den Hub nicht** → Hub aus/ein, näher ran, ggf. anderes Programm/BLE-Verbindung trennen, erneut drücken.
- **Exit-Code ≠ 0** → Details im Output-Panel „Pybricks SPIKE“ lesen.

## Hinweise

- Pausiert in v0.1 (kommen später zurück): Simulationsfenster, ESP32/Pymakr-Flow, Auto-Sync, Batterie-Anzeige.
- Lizenz: GPL-3.0-only, siehe `LICENSE`.

## Entwicklung

```bash
npm install
npm run lint
npm run package   # erzeugt .vsix
```

Veröffentlichen (Maintainer):

```bash
vsce login JulianSeckinger
vsce publish minor
```
