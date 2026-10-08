# F5 – Konflikt mit VS Codes Debugger behoben

Stand: 08.10.2026, private Version 0.0.10.

Benutzerbeobachtung: F5 mit aktivierten Commander-Tasten löst zusätzlich den VS-Code-Debugger aus; dessen `npm: build`-Prelaunch schlägt fehl. Die Dateiliste verwendete nur `preventDefault`. VS Codes Webview-Bridge leitet `keydown` am Content-Window weiter und prüft dabei nicht `defaultPrevented` (lokal in VS Code 1.140.0 unter `out/vs/workbench/contrib/webview/browser/pre/index.html` geprüft).

Behebung: behandelte unmodifizierte Commander-Tasten F3–F8 rufen zusätzlich `stopPropagation` auf, sodass das Ereignis die Window-Bridge nicht erreicht. Die Behandlung gilt nur für die fokussierte Dateizeile und aktivierte `filetandem.commanderKeys`; modifizierte Tasten und Eingabefelder behalten Host-Tastenkürzel. Die Debug-Konfiguration des Projekts wird weiterhin über den normalen VS-Code-Kontext verwendet.

Regression: gerenderte React-Dateiliste mit Window-Listener entsprechend der Host-Bridge. F5 sendet genau einen Transferauftrag und erreicht den Listener nicht. Umschalt+F5 und F5 im Pfadeingabefeld senden keinen Transfer und erreichen den Listener. Bestehende Auswahl-/Queue-/Drag-/Bedienprüfungen bleiben erfolgreich. `npm run quality`, private Paketierung inklusive Inhaltsprüfung sowie Installation in frischen VS-Code-Profilen prüfen den Kandidaten. Es wird kein erneuter Ruhezustands-/Performance-Lauf für diese begrenzte Ereignisänderung behauptet.

Rohlogs: `out/m6/f5-quality.log` und Installationstestlogs; VSIX `out/FileTandem-0.0.10.vsix` mit SHA-256-Sidecar. Das Update enthält weiterhin die Migration von `xscp` nach `filetandem`.
