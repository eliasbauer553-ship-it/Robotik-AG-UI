# Changelog

## 0.3.1

- **Diagnosebericht kopieren** (Werkzeuge / Befehlspalette): Versionen, Python, pybricksdev, unterstützte Optionen und letztes Log in die Zwischenablage – hilft bei der Fehlersuche am echten Hub.
- Entwicklung: ESLint-Konfiguration, `npm test` (Lint + Logik- und Simulationstests, ohne Hub und ohne VS Code lauffähig).

## 0.3.0

- **Klassenmodus:** gleiche Datei auf mehrere Hubs (parallel, Status pro Hub).
- **Messwerte:** `print()`-Zahlen live als Liniendiagramm in der Seitenleiste.
- **Fehler im Editor:** Traceback-Zeile des Hubs wird als Diagnose markiert, mit Sprung zur Zeile.
- **Vorab-Prüfung:** Syntaxcheck (blockiert den Upload) und Warnungen für typische Anfängerfehler.
- **Aufgabenkarten** (eingebaut + eigene per `robotik-tasks.json`) mit Startdatei.
- **Autovervollständigung:** Pybricks-Stubs automatisch eingerichtet.
- **Neues Projekt anlegen** (Ordner mit `main.py` und README).

## 0.2.0

- **Neu:** Seitenleiste mit Roboter-Symbol in der Activity Bar (Webview-GUI).
- Hubs suchen (Signalstärke), wählen, Verbindung testen, löschen; „Automatisch“-Modus.
- Fortschrittsanzeige in Schritten, Live-Log mit getrennter Hub-Ausgabe, Stop-Knopf.
- „Nur hochladen“ (ohne Start) und „Programm vom Hub löschen“.
- Verständliche Fehlerhinweise mit Reparatur-Knöpfen.
- Eigene Python-Umgebung (venv) für pybricksdev statt System-pip (funktioniert auch bei „externally-managed-environment“).
- Vorlagen, Snippets, Verlauf, Auto-Upload beim Speichern, Statusleisten-Eintrag, Tastenkürzel.
- Fix: Der Befehl wurde bisher doppelt gestartet (Terminal + Hintergrundprozess) – jetzt nur noch einmal.

## 0.1.1

- Strukturelle Verbesserungen der Extensionbeschreibung.

## 0.1.0

- Stand jetzt wird noch an dem automatischen verbindungsprozess gearbeitet
- Erster Marketplace-fähiger Stand: nur noch **⬇️ SPIKE-Knopf**.
- Aktive `.py`-Datei wird per `pybricksdev run ble` verbunden, übertragen und gestartet.
- Automatisches Finden von System-Python (>= 3.10, Windows/Mac/Linux) statt hartcodiertem `.venv`-Pfad.
- Automatisches Nachinstallieren von `pybricksdev` per `pip` beim ersten Klick.
- Entfernt/pausiert: Julian-Button mit Absolutpfad, ESP32/Pymakr-Flow, Simulationsfenster, Auto-Sync, Batterie-Dummy.
- `package.json`: Publisher `JulianSeckinger`, Beschreibung, Repository, Lizenz, Keywords, moderne `activationEvents`.
