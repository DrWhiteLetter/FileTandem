# Release 1.0.0 – öffentliche GitHub-Version

Stand: 06.11.2026. Erste finale Version als VSIX auf GitHub; keine Marketplace-Veröffentlichung. Der Projektinhaber hat die öffentliche Freigabe ausdrücklich beauftragt.

## Umfang und Kompatibilität

- VS Code Desktop ab 1.140.0, deutsche und englische Oberfläche, MIT-Lizenz.
- Bestehende Extension-ID `xscp-dev.xscp` und Datenmigration bleiben unverändert. `private: true` im npm-Manifest verhindert nur eine versehentliche npm-Veröffentlichung.
- [Windows-Rückmeldung](Windows-Desktop.md) und [Linux-Rückmeldung](Linux-Desktop.md) stammen aus manuellen Tests des Projektinhabers vor 1.0.0, nicht aus einer erneuten Installation dieses finalen Artefakts.
- Linux-Umgebung: Debian 13.7, Xfce, ARM64, VS Code 1.145.0, Paket `code_1.145.0-1793748906_arm64.deb`.
- Weitere Distributionen/Architekturen, macOS Intel, spezielle WSL-/Container-/UNC-Kombinationen und vollständige manuelle Screenreader-Abnahme bleiben offen. Historische M6-Planungen sind keine pauschale Zertifizierung dieser Umgebungen.

## Veröffentlichungsvorbereitung

README, Installationsanleitung, Plattformangaben, Changelog, Repository-/Issue-Metadaten und vertraulicher Sicherheitskontakt wurden aktualisiert. Die deutsche und englische Website wurde lokal für 1.0.0 vorbereitet; kein Website-Deployment beauftragt. Die dortigen Screenshots bleiben als Aufnahmen aus 0.0.27 gekennzeichnet.

Die erreichbare Git-Historie wurde mit Mustern für private Schlüssel, übliche Zugangstokens und URLs mit eingebetteten Kennwörtern geprüft: 1.113 Blobs, keine Treffer. Das ist eine gezielte Prüfung, kein vollständiges Sicherheitsaudit. Die Fixture-Schlüssel liegen ausschließlich in ignorierten Laufzeitverzeichnissen.

`npm audit` meldete nach Aktualisierung der Entwicklungsabhängigkeit minimatch auf 11.0.1 über einen Override keine bekannten Schwachstellen. Produktive Abhängigkeiten wurden nicht verändert. Der Override wird durch die Qualitätsprüfung mitgetestet.

## Korrekturen aus der Release-Prüfung

- Ein unmittelbar eingereihter Transfer konnte beim expliziten Flush noch im Journal fehlen, weil Queue-Benachrichtigungen gebündelt werden. Flush übernimmt jetzt nach Abschluss des Journal-Ladens einen aktuellen Queue-Snapshot. Der echte Reload-Test prüft Wiederherstellung als unterbrochen und ausschließlich ausdrücklichen Neustart.
- Der Editor-Test prüft den Warnhinweis passend zur aktiven Sprache.
- Der Release-Runner liest die tatsächliche VS-Code-Version aus der Installation und weist einen unerwartet aktualisierten Cache zurück. Die Mindestversion wurde frisch heruntergeladen.

## Validierung

**26 von 26 Prüfschritten erfolgreich** auf macOS ARM64 (Darwin 25.6.0), Node 22.13.1, mit den tatsächlich verifizierten VS-Code-Versionen **1.140.0 und 1.145.0**. [Maschinenlesbare Ergebnisse](Release-1.0.0-Ergebnisse.json).

- Lokalisierung, Lint, Syntax, 143 Unit-Tests, 12 Webview-Tests und Build.
- Lokale SSH-Fixtures, SFTP/SCP/Authentifizierung/Host-Keys/Transfers, Editor-Service und Integritätsfälle einschließlich lokal vollem Datenträger.
- Paketprüfung und Migration bestehender Einstellungen.
- Je VS-Code-Version: Installation in sauberem Profil, Browser-/Queue-Neustart, Editor lokal und in echtem Remote-SSH-Fenster, automatisierte Accessibility-Prüfungen, Restricted Mode, echter Reload, parallele Fenster und native F5-Übertragung.

Nach Eintragen dieser Nachweise wird die VSIX nochmals gebaut und in einem sauberen Profil installiert geprüft. Die zum ausgelieferten Paket gehörige SHA-256-Prüfsumme liegt beim GitHub-Release; die Regression oben bezieht sich auf denselben Produktcode. Vollständige Schrittlogs liegen lokal unter `out/m6/`.

Die Website bestand die automatisierte DE/EN-Prüfung von Animation, Pause/Fortsetzung, Wiederholung, reduzierter Bewegung, Screenshot-Dialog und lokalen Links/Assets. Eine zusätzliche visuelle Browserprüfung war wegen nicht verfügbarer Browsersteuerung nicht möglich.
