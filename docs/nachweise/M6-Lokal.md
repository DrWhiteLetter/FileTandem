# M6 – Lokale Release-Härtung

Stand: **08.10.2026**, private Kandidatenversion **0.0.8**. Benutzerauftrag: alle hier selbst durchführbaren M6-Arbeiten erledigen; Windows-/Linux-Systeme aktuell nicht verfügbar. Juristisches Okay für FileTandem laut Benutzer dokumentiert. Der Marketplace-Publisher ist weiterhin ein Entwicklungsplatzhalter.

## Ergebnis und Restpunkte

| Item | Lokales Ergebnis | Verbleibende Abnahme |
| --- | --- | --- |
| M6-01 | Reproduzierbarer Runner; 23 Schritte bestanden, beide VS-Code-Versionen, echter Restricted Mode | Gehosteter CI-Lauf benötigt Remote-Repository; aktuell kein Git-Remote konfiguriert |
| M6-02 | macOS Apple Silicon und echtes Remote-SSH-Fenster bestanden | Windows/Linux, macOS Intel, WSL/Dev Containers/Codespaces und plattformspezifische Namen/UNC |
| M6-03 | TCP-Abbruch, tatsächliches Remote-/Local-ENOSPC, Finalisierungsabbruch, Symlinks, Restart, echter Reload und zwei gleichzeitige Fenster bestanden | Nachgeprüft: 35 Sekunden echter Ruhezustand, beide Ziele mit korrektem Hash. [Nachweis](M6-03.md) |
| M6-04 | >4-GiB-Datei in beide Richtungen über SFTP/SCP, Speicherziel, kleine Dateien und 10.000 Einträge gemessen | Keine offene lokale Messung; Messwerte sind keine Zusage für beliebige Server/RTT |
| M6-05 | Lokaler Code-/Host-Key-/CSP-/Secrets-/Parserreview, Abhängigkeiten und Paketinhalt geprüft | M6-05 abgeschlossen, siehe [Einzelnachweis](M6-05.md); 1.0-Gesamtfreigabe weiterhin an M6-02/M6-03 gebunden |
| M6-06 | Installation, Quickstart, SCP-Voraussetzungen, Grenzen, Diagnose/Wartung, CHANGELOG und Lizenzhinweise fertig | M6-06 abgeschlossen, siehe [Nachweis](M6-06.md); öffentliche Adressen erst nach Einrichtung |
| M6-07 | Private 0.0.8 im frischen Profil installiert; beide Protokolle, Editor, Remote-SSH, Restart/Reload geprüft | Vollständiges technisches 1.0-Abnahmetor bleibt wegen offener Matrix/Bedienabnahmen offen |
| M6-08 | MIT, Name/Logo/Texte vorhanden; juristisches Okay laut Benutzer abgeschlossen | Tatsächliches Publisher-Konto und Übergang der Extension-Identität |
| M6-09 | Kein öffentlicher Upload | Technische Gesamtfreigabe, Publisher und ausdrücklicher Veröffentlichungsauftrag |

Vollständige manuelle Screenreader-/Tastaturabnahme bleibt offen. Native Theme-/Zoom-/Virtualisierungsprüfungen und React-/API-Tests sind erfolgt, aber kein Ersatz für menschliche Screenreader-Bedienung. Der Benutzer hat anschließend echten Systemruhezustand ausgelöst; [M6-03](M6-03.md) ist abgeschlossen. Das Produkt bleibt eine private Vorabversion, nicht pauschal Version 1.0.

## Regression und konkrete Umgebung

Apple M1, 8 Kerne, 16 GiB RAM, Darwin 25.6.0 / macOS 26.6.2. Entwicklungs-Node 22.13.1. Mindestversion VS Code **1.140.0**, zusätzlich isoliert heruntergeladene **1.141.0**, laut [offiziellen Release Notes](https://code.visualstudio.com/updates/v1_141) Stable vom 07.10.2026. Die normale VS-Code-Installation und persönliche Profile/SSH-Einstellungen bleiben erhalten.

`npm run test:release` umfasst:

- Lint, Syntax, Build, 47 Unit- und drei gerenderte React-Tests.
- Verifikation der eigenen SSH-Fixtures, 31 Protokoll-/Auth-/Host-Key-/Resume-Tests, einen Editor-Service-Test und sechs neue reale Fehlerprüfungen.
- Lokales volles macOS-Testvolume: SFTP und SCP erhalten das alte Downloadziel bei echtem `ENOSPC`.
- ZIP-/Lizenz-/NLS-/Asset-/Geheimnisprüfung der privaten VSIX.
- Je VS-Code-Version sieben echte Abnahmen: frische VSIX-Installation und Webview-Handshake; normale Starts mit persistentem Neustart und beiden Protokollen; installierter Editor; echter Remote-SSH-Editor mit Cross-Host-Zugriff; 10.000 reale Einträge bei Dark/High Contrast/High Contrast Light und Zoom; Restricted Mode; echter Fenster-Reload. Zusätzlich je Version zwei gleichzeitige installierte Fenster. Insgesamt **23 Runner-Schritte**.

Restricted Mode wird in einem separaten frischen Profil mit `security.workspace.trust.emptyWindow: false` geprüft: tatsächliches `workspace.isTrusted === false`, auf Datenträger vorhandene VSIX, keine aktivierte FileTandem-Extension und kein zugänglicher `xscp`-Provider. VS Code darf deaktivierte Erweiterungen aus der Extension-API ausblenden. Ein Fenster mit aktiviertem Workspace-Vertrauen gilt nicht als erfolgreicher Restricted-Mode-Test.

Reload verwendet den normalen `workbench.action.reloadWindow`-Befehl. Nach Host-Neustart ist der zuvor wartende Auftrag **interrupted**, das Ziel fehlt und wird erst nach ausdrücklichem Retry mit korrektem SHA-256 erzeugt. Der beim Reload erwartete RPC-Abbruch ist kein Fehler des Produkts; Erfolg meldet ausschließlich der neue Host nach Prüfung.

Bei zwei gleichzeitigen, unabhängigen Fenstern schreiben jeweils zwei verschiedene 64-MiB-Quellen auf dasselbe neue Serverziel. Für SFTP und SCP veröffentlicht genau ein Fenster; das andere meldet einen Fehler. Größe und SHA-256 des Ziels entsprechen vollständig der Gewinnerquelle. Das ist keine Behauptung globaler fensterübergreifender Queue-Locks und kein CAS-Nachweis für die Ersetzung bestehender Dateien.

## Fehler und Integrität

Ein eigener Loopback-TCP-Proxy trennt echte SSH-Pakete während laufender Uploads. Die Queue endet sichtbar mit Fehler, das bestehende Ziel und eine fremde Teil-Datei behalten ihre Hashes. Nach bestätigter Wiederverbindung wird ausschließlich die zum Auftrag gehörige Partial bereinigt.

Die Remote-Fixtures haben `/limited` als **1-MiB-tmpfs**. Ein 2-MiB-Upload scheitert an tatsächlich fehlendem Speicher, behält das alte Ziel und eine begrenzte Partial. Für lokale Downloads erzeugt `hdiutil` ein eigenes **16-MiB-HFS+-Testvolume**; 32-MiB-Downloads scheitern mit `ENOSPC` und erhalten das vorherige Ziel. Das Volume wird ausgehängt und entfernt.

Ein Abbruch nach Metadatenvorbereitung, unmittelbar vor der Veröffentlichung, bewahrt das alte Ziel. Eine 500-ms-TCP-Pause setzt den Transfer mit korrektem Hash fort. Symlink-/Baumregeln, geänderte Quellen/Präfixe, unabhängige Sitzungspfade und Journalintegrität sind zusätzlich durch die bestehende reale Regression abgedeckt.

## Performance

Dateigröße **4.296.015.872 Byte = 4 GiB + 1 MiB**; beide Richtungen und Protokolle ergeben SHA-256 `5e069629cdcf91b75240a496a87413fa9084c86f344835ce15e2cad32433b199`. Gemessen wird der Produktions-TransferEngine-/Queuepfad einschließlich Quellhash, Streaming, Zielprüfung und Veröffentlichung. Die Laufzeitmessung enthält zusätzliche lokale Nachprüfung beim Download.

| Protokoll / Richtung | Zeit | Nutzdaten / Gesamtzeit | Zusätzlicher RSS |
| --- | ---: | ---: | ---: |
| SFTP Upload | 114,286 s | 35,85 MiB/s | 3,95 MiB |
| SFTP Download | 121,794 s | 33,64 MiB/s | 5,08 MiB |
| SCP Upload | 63,846 s | 64,17 MiB/s | 4,80 MiB |
| SCP Download | 59,552 s | 68,80 MiB/s | 76,53 MiB |

**Unter 128 MiB zusätzlichem RSS** in allen vier Einzelfällen. Ein 64-MiB-Warmlauf dient zum Vergleich; die Peak-RSS-Werte belegen keine mit 4 GiB linear wachsenden Dateibuffer. RSS wird alle 20 ms plus am Messende im Node-Testprozess gemessen, nicht als Gesamtverbrauch von VS Code/Electron oder vom Server. GC-/Baseline-Schwankungen sind in den Rohdaten sichtbar.

1.000 Dateien à 4 KiB: SFTP 8,561 s, SCP 30,932 s. 10.000 Einträge: lokale Liste 55,7 ms, SFTP 126,0 ms, SCP 131,1 ms. Diese Zeiten messen Backend-Listen, nicht die gesamte Anzeigezeit; die echte Webview-Virtualisierung ist separat geprüft. Metadaten-Roundtrip-Median aus 20 Messungen: SFTP 0,516 ms, SCP 2,486 ms. Das sind Anwendungslaufzeiten über Loopback/Colima, keine reine ICMP-RTT.

Ziel: Debian 12/OpenSSH 9.2p1, Colima-Profil xscp mit zwei CPUs, 2 GiB RAM und 10-GiB-Disk; Protokollcontainer auf 0,5 CPU / 128 MiB / 64 PIDs begrenzt. Große Dateien werden nacheinander entfernt; keine produktiven Server und kein Füllen des Desktop-Datenträgers. Der Lastlauf entstand auf 0.0.7; 0.0.8 enthält denselben Produkt-Laufzeitquellstand und ergänzt Test-/Paket-/Dokumentationsarbeit. Rohdaten referenzieren Commit `070b3cc`.

Der erste Benchmark-Helfer verwendete beim Aufräumen 16 gleichzeitige SCP-Exec-Kanäle und überschritt damit das OpenSSH-Sessionlimit. Die Produktionsqueue verwendet zwei Transfers. Der Helfer wurde auf zwei parallele Operationen begrenzt; die bereits erfolgreichen großen/kleinen Transfers wurden behalten, die fehlenden Listenmessungen separat erfolgreich abgeschlossen. Der erste Protokolllauf ohne passenden Docker-Kontext und die Entwicklungsfehler im Restricted-/Reload-Harness sind korrigiert; nur die erfolgreichen finalen Prüfergebnisse zählen als Abnahme.

## Sicherheitsreview und Artefakt

- SSH-Verbindungen ausschließlich über `connectSsh` mit verpflichtender Host-Key-Policy; geänderter Schlüssel und Ablehnung real geprüft. Keine frei eingespeisten SSH-Algorithmen, Proxy-Sockets oder ungeprüfter Fallback.
- Beide Webviews: `default-src 'none'`, lokaler Style-/Font-Ursprung, zufällige Script-Nonce und lokale Resource-Roots. Namen werden als React-Text ausgegeben; keine HTML-Ausführung von Dateinamen.
- Nachrichten: exakte erlaubte Felder, Sitzung/ID, begrenzte Listen/Pfade, keine Secrets oder beliebigen Shell-Befehle. Hostseitige Ziel-/Profil-/Workspace-Guards bleiben maßgeblich.
- SCP: literale Shell-Quotierung, sichere Namen, Header-/UTF-8-/ACK-/Größenprüfung, exakte Ganzzahlen und begrenzte Listen/Ausgabe. Negative Parser-/Transporttests bestehen.
- Profile/Exporte enthalten keine Secretwerte; Anmeldung bleibt in Backend/SecretStorage. Produktive Queue-Fehler sind generisch. Journal-HMAC, begrenzte Wiederaufnahme und Bereinigung eigener Partial-Zuordnung werden geprüft.
- `npm audit --json`: **0 bekannte Schwachstellen** am 08.10.2026, einschließlich Entwicklungsabhängigkeiten. Fixierte Versionen bleiben erhalten; kein externer Penetrationstest behauptet.
- ZIP-Inspektion prüft Lizenzen/NLS, lokale Fonts und manifestreferenzierte Logos bytegleich sowie Ausschluss von Testkeys, Passwörtern, Runtime-/Entwicklungsdateien, Native-Addons und Source Maps.

Quellen: [verdichtete Rohdaten](M6-Ergebnisse.json), lokale Schrittlogs unter `out/m6/`, [Release-Anleitung](../release-anleitung.md) und [M6-Backlog](../meilensteine/M6.md). Die finale private VSIX liegt in `out/FileTandem-0.0.8.vsix`; die SHA-256-Prüfsumme daneben in `out/FileTandem-0.0.8.vsix.sha256`. Sie wird nach der letzten Dokumentationsänderung neu erzeugt; der Hash wird nicht in eine mitpaketierte Datei eingebettet, um eine zirkuläre Prüfsumme zu vermeiden. Zugehöriger Commit: M6-Commit mit diesem Nachweis.
