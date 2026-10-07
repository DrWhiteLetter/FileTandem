# xScp

Entwicklungsprototyp einer VS-Code-Desktop-Erweiterung für SFTP und SCP. M0-01 liefert den Startbefehl und ein minimales React-Webview; Dateiübertragungen sind noch nicht implementiert.

## Entwicklung

Voraussetzungen: Node.js ab 22.13.1 mit npm sowie VS Code Desktop 1.139.1 (M0-01) bzw. 1.140.0 (M0-02 lokal). Die vorläufige Manifest-Untergrenze 1.139.0 wird in M0-09 überprüft. macOS ist die zuerst geprüfte Plattform.

```sh
# Mit nvm, falls vorhanden:
nvm use
npm ci
npm run build
npm start
```

Im Extension Development Host die Befehlspalette öffnen und **xScp: Dateimanager öffnen** ausführen. Dies funktioniert auch ohne Projektordner. Alternativ dieses Repository in VS Code öffnen und mit **F5** die Konfiguration **xScp: Extension Development Host** starten; der Build läuft zuvor automatisch.

`npm start` findet auf macOS die Standardinstallation unter `/Applications/Visual Studio Code.app`. Auf Linux/Windows muss die Code-CLI im PATH liegen. Für andere Installationen `VSCODE_EXECUTABLE` auf den vollständigen Code-CLI-Pfad setzen (unter Windows `code.cmd`). Nur macOS ist bislang geprüft.

```sh
npm run watch  # beide Bundles bei Änderungen neu bauen; Host anschließend neu laden
npm run check  # JavaScript-Syntax prüfen
npm test       # echter Extension-Host-Smoke-Test; lädt VS Code 1.139.1 bei Bedarf
```

Für Tests mit einer vorhandenen Installation kann `VSCODE_TEST_EXECUTABLE` auf die VS-Code-Programmdatei gesetzt werden (macOS: `/Applications/Visual Studio Code.app/Contents/MacOS/Code`). Start und Tests verwenden separate VS-Code-Entwicklungs-/Testprofile unter `.vscode-test/`. Bei sehr langen Checkout-Pfaden kann VS Code unter macOS an der Socket-Pfadgrenze scheitern; dann das Repository unter einem kürzeren Pfad auschecken. Der automatisierte Test prüft Aktivierung, Befehl und Webview-Tab; die sichtbare React-Ausgabe zusätzlich manuell prüfen.

## Aufbau

- `src/extension.js`: ES-Modul mit VS-Code-Befehl und Webview-Lifecycle.
- `webview/src/`: React/JSX und Theme-CSS für den Browser.
- `scripts/build.mjs`: esbuild erzeugt `dist/extension.cjs` für Node sowie `dist/webview.js` und `dist/webview.css` für die Webview. `vscode` bleibt extern; Source Maps unterstützen Debugging.
- `jsconfig.json`: JavaScript/JSX-Projekt und Editor-Unterstützung mit VS-Code-Typen und JSDoc; kein TypeScript-Compiler.

Die Webview nutzt nur lokale Assets mit CSP. Restricted Mode deaktiviert die Erweiterung. `extensionKind: ["ui"]` bindet die Erweiterung an den lokalen Desktop-Host; Packaging, CI und die vollständige Oberfläche folgen in späteren Items.

[M0-02-Nachweis und Remote-Prüfschritte](docs/nachweise/M0-02.md) · [Backlog](docs/meilensteine/README.md) · [Umsetzungsplan](UMSETZUNGSPLAN.md) · [M0-01-Nachweis](docs/nachweise/M0-01.md)

Build-Konzept nach der [offiziellen VS-Code-Anleitung](https://code.visualstudio.com/api/working-with-extensions/bundling-extension), Host-Tests nach [Testing Extensions](https://code.visualstudio.com/api/working-with-extensions/testing-extension).

## Lokaler Ausführungsort (M0-02)

Die Dateiquelle „Lokal · Mein Rechner“ ist das Desktop-Dateisystem, auch bei einem Remote-Workspace. Der Befehl **xScp: Lokalen Dateizugriff nachweisen** öffnet eine Dateiauswahl mit lokalem `file:`-Startpfad im Home-Verzeichnis. Eine bewusst erstellte, kleine Testdatei auswählen; der Ausgabekanal **xScp: Ausführungsort** zeigt Ausführungsart, Remote-Fenster-Kontext, Betriebssystem, Hostnamen, lokale Datei, Bytezahl und SHA-256. Dateiinhalt wird nicht ausgegeben. Der Dateipfad und Hostname dienen dem lokalen technischen Nachweis; vor Weitergabe des Protokolls gegebenenfalls kürzen.

`npm test` prüft den lokalen Zugriff gegen einen vom Desktop-Teststarter erzeugten Zufallsmarker. Der Marker wird anschließend entfernt. Der tatsächliche Remote-SSH-Nachweis bleibt offen: Der nachträglich freigegebene SSH-Testserver erlaubt die Anmeldung, erfüllt aber nicht die Laufzeitvoraussetzungen von VS Code Server. Ein kompatibler Testhost ist erforderlich. Vorgehen und automatischer Remote-Test stehen im [Nachweis](docs/nachweise/M0-02.md). Eine `remote.extensionKind`-Übersteuerung auf `workspace` wird nicht unterstützt. Remote-Workspace-URIs werden nie als lokale Pfade gelesen. Der Prototyp-Nachweis akzeptiert keine `file:`-Authority/UNC-Pfade; Windows-/UNC-Unterstützung bleibt separat zu testen.
