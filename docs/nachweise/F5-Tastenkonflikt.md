# F5 – Konflikt mit VS Codes Debugger behoben

Historischer Stand: 08.10.2026, private Version 0.0.10; dieser erste Fix war bei Fokuswechsel unvollständig. Aktueller Nachtrag unten.

Benutzerbeobachtung: F5 mit aktivierten Commander-Tasten löst zusätzlich den VS-Code-Debugger aus; dessen `npm: build`-Prelaunch schlägt fehl. Die Dateiliste verwendete nur `preventDefault`. VS Codes Webview-Bridge leitet `keydown` am Content-Window weiter und prüft dabei nicht `defaultPrevented` (lokal in VS Code 1.140.0 unter `out/vs/workbench/contrib/webview/browser/pre/index.html` geprüft).

Behebung: behandelte unmodifizierte Commander-Tasten F3–F8 rufen zusätzlich `stopPropagation` auf, sodass das Ereignis die Window-Bridge nicht erreicht. Die Behandlung gilt nur für die fokussierte Dateizeile und aktivierte `filetandem.commanderKeys`; modifizierte Tasten und Eingabefelder behalten Host-Tastenkürzel. Die Debug-Konfiguration des Projekts wird weiterhin über den normalen VS-Code-Kontext verwendet.

Regression: gerenderte React-Dateiliste mit Window-Listener entsprechend der Host-Bridge. F5 sendet genau einen Transferauftrag und erreicht den Listener nicht. Umschalt+F5 und F5 im Pfadeingabefeld senden keinen Transfer und erreichen den Listener. Bestehende Auswahl-/Queue-/Drag-/Bedienprüfungen bleiben erfolgreich. `npm run quality`, private Paketierung inklusive Inhaltsprüfung sowie Installation in frischen VS-Code-Profilen prüfen den Kandidaten. Es wird kein erneuter Ruhezustands-/Performance-Lauf für diese begrenzte Ereignisänderung behauptet.

Rohlogs: `out/m6/f5-quality.log` und Installationstestlogs; VSIX `out/FileTandem-0.0.10.vsix` mit SHA-256-Sidecar. Das Update enthält weiterhin die Migration von `xscp` nach `filetandem`.

## Nachprüfung und vollständige Behebung in 0.0.11

Der DOM-Test allein erfasste den Fokuswechsel nicht. Nativer Electron-/Chromium-Test mit `Input.dispatchKeyEvent` (`isTrusted: true`) im installierten VS-Code-Fenster: eigene Datei auswählen, anschließend Toolbar-Button fokussieren und F5 drücken. Mit 0.0.10 wurde tatsächlich die Debug-Prelaunch-Aufgabe gestartet; ihr Marker belegte den Fehler.

0.0.11 registriert auf Host-Ebene `filetandem.copySelection` für F5, eingeschränkt durch aktives FileTandem-Panel und aktivierte Commander-Einstellung. Der Host sendet eine sitzungsgebundene Nachricht an das aktive Panel. Die Oberfläche überträgt die Auswahl im zuletzt gewählten Bereich genau einmal; identische Nachrichten-IDs werden verworfen. F5 in Eingabefeldern startet keinen Transfer. Andere Commander-Tasten werden ebenfalls im FileTandem-Panel gegen globale Tastenkonflikte abgegrenzt. Außerhalb des Panels bleiben VS-Code-Tasten aktiv.

Der native Test prüft einen tatsächlichen 512-KiB-SFTP-Upload in eigene Fixtures, SHA-256, genau einen Auftrag und das Ausbleiben des Debug-Startmarkers. Als positive Kontrolle wird anschließend ein normaler Code-Editor geöffnet: F5 muss dort die Test-Debug-Aufgabe weiterhin starten. Beide Profile und alle Testdaten werden danach entfernt. Keine produktiven Verbindungen werden verwendet.

Reproduzierbar: `npm run test:native:f5` mit gestarteten eigenen SSH-Fixtures, optional `VSCODE_TEST_EXECUTABLE`. Ergebnisse unter `out/m6/native-f5-<VS-Code-Version>.json`, Baseline-Fehler unter `out/m6/native-f5-baseline-toolbar.log`. Der Test startet ausschließlich eine harmlose Debug-Konfiguration im privaten Testworkspace.

Ergebnis 0.0.11: bestanden auf VS Code 1.140.0 und 1.141.0. `npm run quality`: 51 Unit- und 3 Webview-Tests bestanden, Lint, Typprüfung und Build erfolgreich. Dauerhafter Ergebnisnachweis: [F5-Nativ-Ergebnisse.json](F5-Nativ-Ergebnisse.json). Der komplette Release-Testlauf wurde für diesen begrenzten Fix nicht erneut ausgeführt.
