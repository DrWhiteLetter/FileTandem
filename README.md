# xScp

Entwicklungsprototyp einer VS-Code-Desktop-Erweiterung für SFTP und SCP. M0-01 liefert den Startbefehl und ein minimales React-Webview; Dateiübertragungen sind noch nicht implementiert.

## Entwicklung

Voraussetzungen: Node.js ab 22.13.1 mit npm sowie VS Code Desktop 1.139.1 (aktuell getestete Version). Die vorläufige Manifest-Untergrenze 1.139.0 wird in M0-09 überprüft. macOS ist die zuerst geprüfte Plattform.

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

Die Webview nutzt nur lokale Assets mit CSP. Restricted Mode deaktiviert die Erweiterung. `extensionKind` und Remote-SSH-Nachweise folgen in M0-02; Packaging, CI und die vollständige Oberfläche folgen in späteren Items.

[Backlog](docs/meilensteine/README.md) · [Umsetzungsplan](UMSETZUNGSPLAN.md) · [M0-01-Nachweis](docs/nachweise/M0-01.md)

Build-Konzept nach der [offiziellen VS-Code-Anleitung](https://code.visualstudio.com/api/working-with-extensions/bundling-extension), Host-Tests nach [Testing Extensions](https://code.visualstudio.com/api/working-with-extensions/testing-extension).
