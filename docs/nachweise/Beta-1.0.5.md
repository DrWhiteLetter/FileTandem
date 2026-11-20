# FileTandem 1.0.5 Beta

Stand: 20.11.2026. Vorabversion; Veröffentlichung auf GitHub und im Marketplace vom Benutzer beauftragt.
Identität unverändert: `RootShellForge.filetandem`, Paketversion `1.0.5`,
VSIX mit `--pre-release` als Vorabversion gekennzeichnet.

## Änderungen und Testablauf

- Nach Klick auf Datei oder Ordner in Local/Remote einen Buchstaben oder eine Ziffer drücken: Der nächste passende Eintrag wird ausgewählt und bei Bedarf sichtbar gescrollt. Wiederholtes Drücken wechselt zyklisch durch die Treffer in der angezeigten Sortierung. Groß-/Kleinschreibung wird ignoriert, Umlaute funktionieren. Ausgefilterte Einträge werden übersprungen; Eingabefelder und Tastenkombinationen bleiben erhalten.
- Die Trennlinie zwischen den Dateibereichen ziehen. 30–70 Prozent, Doppelklick oder Enter setzt auf 50:50 zurück; Pfeiltasten (mit Shift in Zehnerschritten), Home und End werden unterstützt. Die Aufteilung wird gespeichert.
- Beide Funktionen auch in der Demo enthalten. Buchstabennavigation öffnet oder überträgt keine Dateien.

`out/FileTandem-1.0.5.vsix` über **Erweiterungen → … → Aus VSIX installieren …**
installieren und VS Code bei Aufforderung neu laden. Version 1.0.5 prüfen.
In beiden Dateilisten mehrere Namen mit gleichem Anfangsbuchstaben testen, auch
bei langen Listen und aktivem Filter. Anschließend Bereichsbreite verstellen und
das Wiederherstellen nach erneutem Öffnen prüfen.

## Nachweise und Grenzen

`npm run quality` bestanden: Lokalisierungsabgleich, Lint, Syntaxprüfung,
148 Unit-Tests, 16 Webview-Tests und Bundle-Bau. Die Webview-Tests prüfen
Buchstabennavigation in beiden Bereichen, Dateien/Ordner, Umlauf, Umlaute,
Ziffern, Filter, Eingabefelder, Tastenkombinationen und virtualisierte Listen.

Neue Aufnahmen der gebauten Oberfläche mit synthetischen Daten für README und
Website DE/EN. Desktop-Aufnahmen (Abschluss/laufende Transfers/automatische
Uploads) sowie schmale Webview-Aufnahme visuell geprüft. Keine echten Profile,
Zugangsdaten oder Serverdateien verwendet. Video/GIF bleiben historische Aufnahmen.

Paketprüfung, isolierter Installationstest, SHA-256, Quell-Commit und Push-Ergebnis
werden für das ausgelieferte Paket im lokalen Build-Nachweis
`out/vsix-build-report-1.0.5.json` festgehalten; Prüfsumme zusätzlich in
`out/FileTandem-1.0.5.vsix.sha256`. Keine neue Windows-/Linux-Desktop-Abnahme,
keine vollständige Screenreader-Abnahme und keine erneute SSH-Protokollmatrix.

Website separat lokal vorbereitet und committed; kein Remote eingerichtet,
also kein Website-Push möglich. Kein Website-Deployment. Die Erweiterungsquellen
werden nach `origin/main` gepusht. GitHub: [Pre-Release v1.0.5](https://github.com/DrWhiteLetter/FileTandem/releases/tag/v1.0.5).
Marketplace-Upload und abgeschlossene Validierung werden getrennt im lokalen
Build-Nachweis dokumentiert; ein Upload allein beweist keine Freischaltung.
