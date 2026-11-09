# Release 1.0.4

Stand: 09.11.2026. Identität unverändert: `RootShellForge.filetandem`.

## Änderungen

- Zustandsabhängige Transferleiste: Pause/Fortsetzen als Symbol mit zugänglichem Namen und Tooltip; Wiederholung mit Anzahl; Aufräumen im beschrifteten Menü „Verlauf“.
- Nach Abschluss kompakte Ergebniszeile ohne Fortschrittsbalken und Geschwindigkeit. Fehler, übersprungene und abgebrochene Aufträge bleiben erkennbar. Eine pausierte Queue lässt sich auch ohne aktive Aufträge fortsetzen.
- Verlaufsmenü mit nativer Tastaturbedienung, Escape, Fokus-Rückgabe und Schließen bei Klick außerhalb. Die bestehenden Backend-Aktionen und Bestätigungen bleiben erhalten.
- Englischer Marketplace-Einstieg, deutsche Anleitung, Suchbegriffe, kurze historische Demo und Feedback-Formulare. Einladungstexte bleiben unversendet.
- Neue Aufnahmen der gebauten Oberfläche für README und Website DE/EN: synthetische Daten in isolierter UI-Vorschau, keine echten Transfers. Video/GIF bleiben ausdrücklich historische Aufnahmen aus 1.0.1.
- Installierter Lokalisierungstest prüft zusätzlich die übersetzten Manifest-Beiträge.

## Prüfung und Auslieferung

`npm run quality`: Lokalisierungsabgleich, Lint, Syntaxprüfung, 148 Unit-Tests,
13 Webview-Tests und Bundle-Bau bestanden. Webview-Tests prüfen unter anderem
Zustandswechsel, globale Pause, Wiederholungen außerhalb der sichtbaren Historie,
Verlaufsaktionen und Escape/Fokusverhalten.

Desktop-Aufnahmen für abgeschlossen/laufend/automatische Uploads und die schmale
Abschlussansicht visuell geprüft. Website-Galerie lokal im Desktop-Browser geprüft;
eine erneute mobile Website-Abnahme ist nicht erfolgt. Keine neue Windows-/Linux-
oder vollständige Screenreader-Abnahme; keine erneute SSH-Protokollmatrix für diese
UI-Änderung.

Paket: `out/FileTandem-1.0.4.vsix`, Prüfsumme in der gleichnamigen `.sha256`-Datei.
Der lokale maschinenlesbare Nachweis `out/vsix-build-report-1.0.4.json` hält
Paketprüfung, isolierte Installation, Lokalisierung EN/DE, Commit-SHA, Push und
Veröffentlichungsstatus getrennt fest. Ein Build oder Upload allein beweist keine
abgeschlossene Marketplace-Validierung.

Website wird separat lokal committed. Kein Remote eingerichtet, daher kein
Website-Push möglich. Kein Website-Deployment. Erweiterungsquellen werden nach
`origin/main` gepusht; die Freigabe zur Erweiterungsveröffentlichung wurde vom
Benutzer ausdrücklich erteilt.
