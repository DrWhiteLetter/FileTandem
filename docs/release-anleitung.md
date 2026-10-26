# FileTandem installieren, verwenden und warten

Stand: 08.10.2026, private Vorabversion 0.0.11. macOS Apple Silicon ist das lokal geprüfte System. Windows/Linux, macOS Intel und weitere Remote-Fensterkombinationen sind nicht freigegeben. Die vollständige 1.0-Abnahme und Marketplace-Veröffentlichung bleiben an [M6](meilensteine/M6.md) gebunden.

## Installation und erster Transfer

1. VS Code Desktop ab 1.140.0 öffnen. Für die lokale M6-Abnahme wird zusätzlich Stable 1.141.0 geprüft. Anwender benötigen kein separat installiertes Node/npm, Docker oder lokales SCP-Programm.
2. Erweiterungen → Menü „…“ → **Aus VSIX installieren…** → `out/FileTandem-0.0.11.vsix` wählen; einen angebotenen Fenster-Reload durchführen.
3. FileTandem in der Activity Bar öffnen. Der Logo-Button oben in **Verbindungen** öffnet den Dateimanager; alternativ **FileTandem: Dateimanager öffnen** in der Befehlspalette.
4. **Profil anlegen** wählen: Host, Port, Benutzer, lokalen und entfernten Startordner sowie Anmeldung eintragen. **SFTP** ist voreingestellt. Ein leerer lokaler Startordner verwendet dein Home-Verzeichnis.
5. **Profil verbinden** wählen. Den SHA-256-Fingerprint des Host-Keys mit einer unabhängig beschafften Angabe vergleichen und ausdrücklich bestätigen. Ein geänderter bekannter Host-Key blockiert die Verbindung.
6. Links lokale Dateien, rechts Serverdateien auswählen. Zielordner öffnen und **Hochladen →** oder **← Herunterladen** wählen. Ordner werden rekursiv übertragen, Symlinks/Spezialdateien übersprungen und im Ergebnis angezeigt.
7. Bei Zielkonflikten bewusst Ersetzen, Überspringen, Beide behalten oder Abbrechen wählen. Die Queue zeigt Fortschritt und Teilfehler; Tab-Schließen stoppt einen begonnenen Transfer nicht.

Passwort, Schlüssel mit optionaler Passphrase, expliziter SSH-Agent und Keyboard-Interactive werden unterstützt. Secrets werden in VS Code SecretStorage abgelegt, nicht in Webview-Nachrichten oder Profilexporten. Windows-Agent und konkrete MFA-/Hardwareverfahren benötigen eigene Abnahmen.

Version 0.0.11 migriert alte `xscp`-Einstellungen automatisch nach `filetandem`; bereits gesetzte neue Werte bleiben erhalten. Für Commander-Tasten in den VS-Code-Einstellungen nach `@id:filetandem.commanderKeys` suchen. Alte Befehl-IDs bleiben für eigene Tastenkürzel kompatibel. Die Extension-ID bleibt vorerst gleich; nach dem Update offene Remote-Editoren erneut aus dem Dateimanager öffnen.

## Installation prüfen und aktualisieren

Nach der Installation in der Erweiterungsansicht den Titel **FileTandem – SFTP & SCP File Manager** und Version **0.0.11** prüfen. Den Dateimanager öffnen und eine eigene kleine Testdatei in einen dafür angelegten Serverordner hochladen, wieder unter anderem lokalen Namen herunterladen und den Inhalt vergleichen. Erst danach mit wichtigen Dateien arbeiten. Die Queue muss den Auftrag als erfolgreich anzeigen; bei einem Fehler zunächst die Diagnose unten verwenden.

Für ein Update laufende Transfers abschließen oder bewusst abbrechen, die neue VSIX über **Aus VSIX installieren…** installieren und den angebotenen Reload ausführen. Version und Testtransfer erneut prüfen. Ein Reload nimmt unterbrochene Aufträge nicht automatisch wieder auf. Eine ältere geprüfte VSIX aufbewahren; ein Downgrade ist keine Zusage der Kompatibilität zukünftiger Profil-/Journalformate.

Zur Deinstallation FileTandem in der Erweiterungsansicht deinstallieren und gegebenenfalls neu laden. Dies löscht keine übertragenen Serverdateien. Gespeicherte Zugangsdaten zuvor über **FileTandem: Gespeicherte Anmeldung vergessen** entfernen, falls gewünscht; ein Profil löschen entfernt ebenfalls dessen gespeicherte Zugangsdaten. Keine vollständigen VS-Code-Datenverzeichnisse als vermeintliche FileTandem-Bereinigung löschen.

## Protokolle und Bearbeitung

SFTP benötigt ein SFTP-Subsystem auf dem Server, keine Shell und keinen VS Code Server. Bestehende SFTP-Dateien bis 10 MiB öffnen zunächst schreibgeschützt. Erst nach **Bearbeitung freigeben** schreibt Speichern beziehungsweise Auto Save zurück. Konflikte erfordern Review/Diff; ohne geeignete atomare Rename-Erweiterung ist der sichere Ersatzweg Download und expliziter Upload in ein neues Ziel.

SCP muss ausdrücklich gewählt werden. Der Zielserver benötigt POSIX-Shell, `scp` und das implementierte GNU/Linux-Werkzeugprofil: GNU `find`, `stat`, `mv`, `ln`, `chmod`, `touch`, `rm`, `rmdir`, `mkdir`, `sha256sum` sowie `grep`. BSD/macOS/BusyBox/Windows-Zielserver sind für SCP nicht zugesagt; SFTP verwenden, sofern verfügbar. Es gibt keinen stillen Protokoll-Fallback. Unsicher darstellbare SCP-Namen werden abgelehnt.

SCP-Bearbeitung verwendet eine lokale private Kopie. Auto Save speichert diese ausschließlich lokal. **Lokale SCP-Kopie hochladen** ist ein eigener ausdrücklicher Auftrag mit Prüfung auf zwischenzeitliche Serveränderungen.

## Abbruch, Wiederanlauf und Datenintegrität

**Queue pausieren** verhindert neue Starts, stoppt aber keine aktiven Streams. **Abbrechen** betrifft den gewählten Auftrag. Nach Reload/Neustart werden frühere laufende oder wartende Aufträge als unterbrochen wiederhergestellt und starten nicht automatisch. **Erneut starten** beginnt bewusst neu; **Fortsetzen** ist nur für geprüfte SFTP-Teil-Dateien verfügbar. Geänderte Quelle, falsches Präfix oder geändertes Profil blockieren Fortsetzung. SCP startet eine Datei neu.

Übertragungen schreiben zunächst eigene `.xscp-<id>.part`-Dateien. Größe/Prüfsumme werden geprüft, bevor das endgültige Ziel veröffentlicht wird. Bei Fehlern können eigene Teil-Dateien zurückbleiben. **Teil-Datei bereinigen** prüft die Auftrags-/Profilzuordnung; fremde Teil-Dateien werden nicht pauschal gelöscht. Bei beschädigtem Journal bleibt eine `.corrupt-…`-Sicherung erhalten. Die Integrität des produktiven Journals wird mit einem SecretStorage-Schlüssel geprüft.

Serveroperationen bieten kein globales Undo. Remote-Löschen ist endgültig und verlangt eine Bestätigung von Zielpfad/Umfang. Lokal wird nach Möglichkeit der Papierkorb verwendet. Server-CAS, Erhalt von Eigentümer/ACLs/Xattrs/Hardlinks und Remote-fsync-Dauerhaftigkeit sind nicht zugesagt. Gleichzeitige externe Schreiber können zwischen Abschlussprüfung und Rename eingreifen.

## Diagnose und Troubleshooting

| Beobachtung | Vorgehen |
| --- | --- |
| Erweiterung in Restricted Mode deaktiviert | Workspace-Vertrauen in VS Code prüfen; nur selbst geprüfte Inhalte freigeben. |
| Host-Key geändert | Verbindung bleibt gesperrt. Änderung unabhängig mit dem Serverbetreiber klären; keinen ungeprüften Ersatz akzeptieren. |
| SFTP funktioniert, SCP nicht | Protokollauswahl und GNU/Linux-Werkzeuge prüfen. SCP ist kein Ersatz für einen fehlenden SFTP-Zugang auf einem beliebigen SSH-Server. |
| Profil in Remote-SSH-Fenster nicht lokal ausgeführt | FileTandem auf dem Desktop installieren; eine `remote.extensionKind`-Übersteuerung entfernen. Linke Dateiquelle bleibt immer der Desktop. |
| Transfer fehlgeschlagen / Datenträger voll | Quelle/Ziel, freien Speicher und Rechte prüfen. Bisheriges Ziel und eigene Teil-Datei prüfen; gezielt neu starten oder SFTP-Fortsetzung wählen. |
| Journal nicht verfügbar | Betriebssystem-/VS-Code-SecretStorage prüfen. Keine gespeicherten Aufträge werden automatisch gestartet. |
| Langsame kleine Dateien | Vollständige Hashprüfung und viele Serveroperationen kosten zusätzliche Zeit. Messwerte unter [M6-Nachweisen](nachweise/M6-Lokal.md) sind keine Internet-Performancezusage. |

Für einen Fehlerbericht Versionsnummer, Desktop-OS/Architektur, VS-Code-Version, Protokoll und reproduzierbare Schritte angeben. Generische Queue-Fehlercodes dürfen geteilt werden. Pfade, Hostnamen und Benutzernamen vor Weitergabe kürzen/anonymisieren. Keine Passwörter, Passphrases, privaten Schlüssel, Agent-Sockets, SecretStorage-/Journal-Schlüssel oder Originaldateiinhalte anhängen. **Lokalen Dateizugriff nachweisen** liest nur eine selbst ausgewählte Testdatei und protokolliert Pfad, Host und SHA-256, keinen Inhalt; auch diese Metadaten vor Weitergabe prüfen.

## Wartung und reproduzierbare Abnahme

Entwicklung mit Node 22.13.1 und npm 10.9.2, `npm ci` und Lockfile. Abhängigkeiten sind fixiert; Updates verlangen erneute Regression und Drittanbieterhinweise. `npm audit` ist eine Momentaufnahme, kein vollständiger Sicherheitsnachweis.

```sh
nvm use
npm ci
npm run quality
# Docker/Colima zuerst bereitstellen: siehe verlinkte Fixture-Anleitung unten.
# Nur die eigenen lokalen SSH-Fixtures starten:
XSCP_DOCKER_CONTEXT=colima-xscp npm run fixtures:start
XSCP_DOCKER_CONTEXT=colima-xscp \
  VSCODE_TEST_EXECUTABLE="/Applications/Visual Studio Code.app/Contents/MacOS/Code" \
  npm run test:release
# Benchmark separat ausführen; nicht parallel zu Protokolltests mit Host-Key-Rotation:
XSCP_DOCKER_CONTEXT=colima-xscp npm run benchmark:release
XSCP_DOCKER_CONTEXT=colima-xscp npm run fixtures:stop
```

Voraussetzungen und Start des isolierten Colima-Profils stehen in der [Fixture-Anleitung](../test/fixtures/ssh/README.md) im Quellrepository. Nach den Tests mit `fixtures:stop` eigene Container entfernen und ein eigens gestartetes Colima-Profil mit `colima stop xscp` wieder stoppen. Der Ordner `test/` wird nicht in die VSIX aufgenommen; diese Wartungsschritte gelten nur für das Quellrepository.

Gezielt nur Fehler-/Integritätsfälle erneut prüfen: mit laufenden eigenen Fixtures `XSCP_DOCKER_CONTEXT=colima-xscp npm run test:faults`. Der Runner prüft Protokoll-/Symlinkregeln, Netzabbruch, Finalisierungsabbruch, volle Datenträger und Restart/Reload/zwei Fenster auf Mindestversion und Stable. Er versetzt den Desktop nicht in Ruhezustand; die erfolgreiche manuelle macOS-Abnahme ist in [M6-03](nachweise/M6-03.md) dokumentiert. Ergebnisse unter `out/m6/faults/results.json`.

Seit 0.0.11 führt der M6-Runner zusätzlich den installierten Migrationstest aus (seit 0.0.11 zusätzlich native F5-Prüfung je VS-Code-Version; 26 Schritte auf macOS). `npm run test:migration` kann ihn separat in eigenen Profilen wiederholen.

Der M6-Runner erzeugt `out/m6/regression.json` und Schrittlogs; der Benchmark erzeugt `out/m6/performance.json`. Stable wird isoliert unter `.vscode-test/` heruntergeladen. `XSCP_STABLE_VERSION` erlaubt einen reproduzierbaren konkreten Stable-Stand; `XSCP_STABLE_EXECUTABLE` eine bereits vorhandene Testinstallation. Die Runner verändern keine persönlichen VS-Code- oder SSH-Einstellungen. Protokolltests mit Host-Key-Rotation und Benchmarks müssen nacheinander laufen. Benchmarks benötigen mindestens 5 GiB freien Platz im Fixture-Dateisystem und etwa 10 GiB lokalen Arbeitsraum; Auftragsgröße 4 GiB plus 1 MiB, 1.000 kleine Dateien und 10.000 Einträge.

`npm run package` baut die private VSIX und prüft ihren ZIP-Inhalt unabhängig. Für Anwender ist nur die VSIX erforderlich; test-only SSH-/Docker-/hdiutil-Helfer werden nicht mitgeliefert. Quelltexte enthalten keine produktiven Zugangsdaten. [MIT-Lizenz](../LICENSE) und [Drittanbieterhinweise](../THIRD_PARTY_NOTICES.md) gehören zum Paket.

## Änderungen warten und Fehler melden

Vor Änderungen `npm ci` mit dem eingecheckten Lockfile verwenden. Bei Bibliotheksupdates Versionen und Lockfile gemeinsam ändern, `npm audit`, `npm run quality` sowie die betroffenen realen Protokoll-/Editorprüfungen ausführen und `THIRD_PARTY_NOTICES.md` mit den tatsächlich gebündelten Lizenzen abgleichen. Vor einem neuen Kandidaten die komplette M6-Regression ausführen, `CHANGELOG.md` und Versionsnummer in Manifest/Lockfile aktualisieren und mit `npm run package` neu paketieren. Die SHA-256-Datei neben der VSIX muss zum ausgelieferten Paket passen; nach jeder mitpaketierten Dokumentationsänderung neu bauen.

Die private Vorabversion hat noch kein öffentliches Support-/Issue-Repository. Fehler über den bisherigen Projektkontakt mit den oben genannten anonymisierten Angaben melden. Ein späteres öffentliches Repository und ein Publisher-Konto werden erst nach ihrer Einrichtung dokumentiert. Für eine öffentliche Version gelten weiterhin die offenen Abnahmepunkte aus dem M6-Backlog.

## Bewusste Grenzen

Manueller Ordnerabgleich über „Ordner abgleichen …“: Richtung wählen, rekursive Vorschau und Transferauswahl bestätigen. Vergleich nach Größe und Änderungszeit (Sekundenauflösung), kein Inhalts-/Hashvergleich; gleiche Metadaten können unterschiedliche Inhalte verdecken. Zusätzliche Zieldateien werden nicht gelöscht. Symlinks, Spezialdateien und Typkonflikte werden übersprungen. Vor dem Start wird die Vorschau erneut geprüft; spätere externe Änderungen unterliegen den bestehenden Transfer-Konfliktprüfungen. Maximal 10.000 Einträge je Seite, Tiefe 100 und 1.000 Transferauswahlen. Windows-/Linux-Desktop-Abnahme des Abgleichs steht aus. Keine automatische Ordner-Synchronisierung / „Entferntes Verzeichnis aktuell halten“, kein Terminal, kein ProxyJump, keine Browser-Ausführung und kein automatischer Upload lokaler Projektdateien. Editorlimit 10 MiB; höchstens 32 gehaltene Editorressourcen und 64 private SCP-Kopien. Das Journal hält maximal 10.000 Aufträge / 32 MiB. Vollständige Screenreader-Abnahme bleibt separat nachzuweisen; echter macOS-Suspend/Resume ist in [M6-03](nachweise/M6-03.md) nachgewiesen. Nicht getestete Desktop-Plattformen bleiben offen.
