# Release 1.0.6

Stand: 23.11.2026. Stabile Ausgabe; Identität unverändert: `RootShellForge.filetandem`.

## Änderungen und Freigabe

- Der Projektinhaber hat den letzten Stand am 23.11.2026 erfolgreich getestet und die Veröffentlichung ausdrücklich beauftragt. Plattform und einzelne Testschritte wurden dabei nicht gesondert angegeben.
- Funktionsstand unverändert gegenüber 1.0.5 Beta: Buchstabennavigation in den Dateilisten und per Maus/Tastatur verstellbare Dateibereiche.
- Version 1.0.6 ist erforderlich, weil Marketplace-Vorabversion und stabile Ausgabe unterschiedliche Versionsnummern benötigen. Manifest, Lockfile, aktuelle Dokumentation und Website DE/EN wurden aktualisiert. VS-Code-Mindestversion bleibt 1.140.0.
- Vorhandene Screenshots stammen weiterhin aus 1.0.5 Beta und bleiben entsprechend gekennzeichnet; die Oberfläche ist unverändert. Historische Videoaufnahmen bleiben unverändert bezeichnet.

## Prüfung und Auslieferung

`npm run quality` mit Node 22.13.1 bestanden: Lokalisierungsabgleich, Lint,
Syntaxprüfung, 148 Unit-Tests, 16 Webview-Tests und Bundle-Bau.

Paket: `out/FileTandem-1.0.6.vsix`, SHA-256 in `out/FileTandem-1.0.6.vsix.sha256`.
Paketprüfung, isolierte Installation, Commit-SHA, Push und tatsächliche
Veröffentlichung werden im lokalen Build-Nachweis
`out/vsix-build-report-1.0.6.json` getrennt festgehalten. Ein Upload allein
beweist keine abgeschlossene Marketplace-Validierung.

Keine erneute SSH-Protokollmatrix, keine neue automatisierte Windows-/Linux-
Desktop-Abnahme und keine vollständige Screenreader-Abnahme. Keine echten
Zugangsdaten oder persönlichen Profile für die automatisierten Tests.

Website DE/EN separat lokal vorbereitet und committed. Kein Remote eingerichtet,
daher kein Website-Push möglich. Kein Website-Deployment; Änderungen betreffen
nur Release-Texte, kein Layout. Keine neue visuelle Desktop-/Mobilabnahme.
Erweiterungsquellen werden nach `origin/main` gepusht.

Geplante Veröffentlichungsziele: [GitHub Release v1.0.6](https://github.com/DrWhiteLetter/FileTandem/releases/tag/v1.0.6)
und [Visual Studio Marketplace](https://marketplace.visualstudio.com/items?itemName=RootShellForge.filetandem).
Der tatsächliche Veröffentlichungsstatus steht im lokalen Build-Nachweis.
