# Release 1.0.1

Stand: 06.11.2026. Update als VSIX über GitHub Releases; Extension-ID und vorhandene Profile bleiben unverändert.

## Änderungen

- `filetandem.checkUploadOwnership`: optionale, standardmäßig deaktivierte Prüfung von UID und GID vor dem Ersetzen vorhandener Serverdateien über die Transferwarteschlange. Abweichungen oder unvollständige Angaben stoppen die betroffene Datei vor dem Veröffentlichen. Die vorhandene Datei bleibt erhalten; eine eigene Teil-Datei kann zur kontrollierten Bereinigung verbleiben. Keine automatische Eigentümeränderung.
- Gilt für SFTP/SCP einschließlich automatischer Uploads und Fortsetzungen. Neue Dateien, Ordner, direkte SFTP-Editor-Speichervorgänge, ACLs und spätere Serveränderungen sind nicht abgedeckt.
- Verwendet die ohnehin benötigten Metadatenabfragen. Der Unit-Test zählt die Abfragen in aktiviertem und deaktiviertem Modus; es entsteht keine zusätzliche Anfrage pro Datei.
- Der Transfer-Konfliktdialog kennzeichnet den Abbruchbutton als native Abbruchaktion, damit VS Code keinen weiteren hinzufügt. „Alle ersetzen“ / „Replace all“ ersetzt die längere Beschriftung; Entscheidungsumfang bleibt dieser Sammelauftrag.
- README-Screenshot aus dem aktuellen Produktionsbundle mit synthetischen Beispieldaten in einem isolierten VS-Code-Profil. Szenario zeigt Dateiübersicht, Transferfortschritt und Aktionen zum Aufräumen des Verlaufs. Die Aufnahme zeigt keine produktiven Verbindungsdaten und keinen echten laufenden Transfer. Reproduzierbar mit `node scripts/capture-readme.mjs` nach Auswahl von Node 22.

## Prüfung

**26 von 26 Release-Prüfschritten erfolgreich** auf macOS ARM64 (Darwin 25.6.0), Node 22.13.1, mit den tatsächlich verifizierten VS-Code-Versionen **1.140.0 und 1.145.0**. [Maschinenlesbare Ergebnisse](Release-1.0.1-Ergebnisse.json).

- Lokalisierung, Lint, Syntax, 148 Unit-Tests, 12 Webview-Tests und Build.
- SSH-Fixtures, 35 Protokolltests einschließlich der Eigentümersperre mit SFTP/SCP, Editor-Service, Integritätsfälle und lokal voller Datenträger.
- Unabhängige Paketprüfung und Migration bestehender Einstellungen.
- Je VS-Code-Version: Installation, Browser-/Queue-Neustart, Editor lokal und in echtem Remote-SSH-Fenster, automatisierte Accessibility-Prüfungen, Restricted Mode, echter Reload, parallele Fenster und native F5-Übertragung.

Nach Eintragen der Nachweise folgt eine erneute Paketierung und Installation des Auslieferungspakets. Die SHA-256-Prüfsumme liegt beim GitHub-Release. `npm audit` meldet keine bekannten Schwachstellen. Der neue README-Screenshot wurde visuell geprüft.

 Vorbereitende Protokolltests haben die Eigentümersperre mit echten SFTP-/SCP-Fixtures und einer abweichend zugeordneten bestehenden Datei bestätigt. Die VS-Code-Prüfung bestätigt den Standardwert `false`, die Aktivierung und das Zurücksetzen der Einstellung.

Die Plattformrückmeldungen des Projektinhabers aus Windows und Debian 13.7 / Xfce / ARM64 mit VS Code 1.145.0 stammen aus der Entwicklung vor 1.0.0. Sie sind keine erneute manuelle Abnahme dieses Update-Artefakts. Weitere Plattformkombinationen und die vollständige manuelle Screenreader-Abnahme bleiben offen; siehe README.

Die Website bleibt im separaten lokalen Projekt vorbereitet und wird mit diesem Extension-Release nicht bereitgestellt.
