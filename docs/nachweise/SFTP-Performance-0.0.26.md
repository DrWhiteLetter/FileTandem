# Upload-Ablauf und SFTP-Performance in 0.0.26

Stand: 4. November 2026. Messungen: 3. November 2026. Ausgangsversion 0.0.25, Commit `8de4106`. Anlass: Upload vieler Dateien von der Laptop-SSD auf denselben Dev-Server ist weiterhin langsamer als mit WinSCP; auch das Befüllen der Queue wirkt langsam.

## Prüfung des gesamten Ablaufs

| Phase | Befund in 0.0.25 | Änderung in 0.0.26 |
| --- | --- | --- |
| Auswahl / Ordner lesen | Die Verzeichnisliste enthält bereits Dateimetadaten. Bei der Rekursion wird jede Datei nochmals einzeln abgefragt. | Gelistete Metadaten für Dateien übernehmen. Ordner vor dem Betreten erneut prüfen. Vor dem eigentlichen Transfer Quelle erneut prüfen. |
| Queue befüllen / starten | Für neue Einträge und Abschlüsse wird die gesamte Historie durchsucht; Microtasks können nach jedem gelesenen Eintrag erneut planen. | Separater Index wartender Aufträge je Server; ausgelastete Server überspringen; Planung im nächsten Event-Loop-Durchlauf bündeln. |
| Konflikte | Die Dialogsperre umfasst auch unabhängige Metadatenabfragen. | Metadaten parallel abfragen, Entscheidungen weiterhin geordnet und „Alle ersetzen“ weiterhin auf einen Sammelauftrag begrenzen. |
| Datei senden | Ein Schreibblock muss bestätigt sein, bevor der nächste gesendet wird. | Bis zu acht ausstehende 64-KiB-Schreibanfragen je Transfer; begrenzter Speicher, alle Bestätigungen vor Abschluss abwarten. |
| Datei lesen / prüfen | Sequenzielles Zurücklesen in 64-KiB-Blöcken. | Bis zu acht Leseanfragen je Fenster, geordnete SHA-256-Verarbeitung, verkürzte Antworten vollständig nachlesen. Frühes Dateiende und Wachstum werden erkannt. |
| TCP | Kleine Steuerpakete können durch TCP-Bündelung verzögert werden. | `TCP_NODELAY` über die öffentliche ssh2-API einschalten. |
| Fortschritt anzeigen | Bei jeder Queue-Aktualisierung werden vollständige Browsermodelle einschließlich Verzeichnislisten und gesamter Transferhistorie übertragen. | Separate Transfermeldungen, maximal 200 sichtbare Zeilen, vollständige Summen und bis zu 1.000 Retry-IDs. Dateilisten bleiben beim reinen Fortschritt unverändert. |
| Dateilisten nachladen | Jeder fertige Auftrag fordert beide Seiten neu an, auch wenn nur ein nicht sichtbarer Unterordner betroffen ist. | Nur tatsächlich betroffene sichtbare Zielbereiche aktualisieren. Überwachungsänderungen aktualisieren weiterhin beide Seiten. |
| Abschluss | Vollständiges Zurücklesen jeder Datei ist verpflichtend. | Schneller Modus als Standard; zusätzliche SHA-256-Abschlussprüfung unter Sicherheitsfeatures optional aktivierbar. |

Die Queue hält weiterhin höchstens vier SFTP-Aufträge pro Server aktiv. Die neue Blockparallelität kommt innerhalb einer Datei hinzu; es werden dafür keine weiteren SSH-Verbindungen oder SFTP-Kanäle geöffnet.

## Schneller Modus

Einstellung unter **FileTandem → Sicherheitsfeatures**: `filetandem.sftpUploadVerification`. Seit der Anpassung vom 4. November ist `size` der Standard; ausdrücklich gesetzte Werte bleiben gültig. Die nachfolgenden Messungen verwendeten explizit gewählte Prüfmodi.

- `sha256`: Optional. Quellhash, Streamhash und vollständig zurückgelesener Zielinhalt müssen übereinstimmen.
- `size`: Standard für manuelle SFTP-Uploads. Quellhash und Streamhash müssen weiter übereinstimmen. SSH schützt den Transport; die Größe der geschriebenen regulären Teil-Datei wird geprüft, Metadaten gesetzt, das bestehende Ziel erneut geprüft und erst dann sicher umbenannt. Das Zurücklesen für den Zielhash entfällt. **Damit wird eine gleich große Verfälschung des gespeicherten Serverinhalts nicht durch einen separaten Zielhash erkannt.**

Der gewählte Prüfmodus wird im Journal gespeichert. Die Oberfläche kennzeichnet schnelle Abschlüsse mit „SSH + Größe geprüft“. Der dort vorhandene Stream-SHA-256-Wert ist in diesem Modus kein Nachweis eines unabhängig zurückgelesenen Zielinhalts.

Die Einstellung gilt beim Start eines neuen Datei-Auftrags. SFTP-Fortsetzungen, automatische Uploadüberwachung und geprüfte Editor-Uploads erzwingen weiterhin `sha256`. Downloads, SCP und lokale Kopien behalten die vollständige Prüfung. Fehlgeschlagene Transfers werden weiterhin nur ausdrücklich erneut gestartet; der schnelle Modus aktiviert keine automatische Wiederholung.

## Recherche

- [WinSCP: Übertragungsgeschwindigkeit](https://winscp.net/eng/docs/faq_slow): Bei SFTP kann Latenz begrenzen, obwohl Bandbreite frei ist. WinSCP hält mehrere Anfragen gleichzeitig offen. Mehr parallele Dateien allein beseitigen das Warten zwischen Blöcken einer einzelnen Datei nicht.
- [ssh2: SFTP-API](https://github.com/mscdex/ssh2/blob/master/SFTP.md): `fastPut`/`fastGet` verwenden parallele Zugriffe; die API dokumentiert konfigurierbare Parallelität und Blockgrößen. FileTandem verwendet eigene begrenzte Fenster, um die bestehenden temporären Dateien, Prüfsummen und Abbruchregeln zu integrieren.
- [Node.js: TCP-Socket und setNoDelay](https://github.com/nodejs/node/blob/main/doc/api/net.md#socketsetnodelaynodelay): TCP-Bündelung kann Latenz zugunsten von Durchsatz erhöhen. `setNoDelay(true)` deaktiviert diese zusätzliche Verzögerung.
- [WinSCP: Prüfsummenvergleich](https://winscp.net/eng/docs/library_example_verify_file_checksum): WinSCP dokumentiert die zusätzliche Prüfsummenprüfung als eigene Erweiterung; serverseitige Berechnung hängt von Serverunterstützung ab. Ein Vergleich mit FileTandems vollständigem Zurücklesen ist deshalb nur bei vergleichbaren Prüfoptionen aussagekräftig. Daraus folgt keine Aussage über die konkrete WinSCP-Konfiguration des Benutzers.
- [ssh2-Maintainer zu parallelen Anfragen und Archivübertragung](https://github.com/mscdex/ssh2-streams/issues/120): Archiv-Streaming über eine Shell kann bei sehr vielen kleinen Dateien weiteren Protokollaufwand vermeiden. Das ist hier nicht implementiert: Es würde Shell-Zugriff, Entpacken sowie ein gesondertes Konflikt-/Abbruchkonzept voraussetzen und wäre kein reiner SFTP-Upload.

## Messbedingungen und Einordnung

Echter lokaler OpenSSH-SFTP-only-Testserver in Colima, macOS arm64 und Node 22.13.1. Ein Quellensnapshot von 0.0.25 und der Kandidat werden nacheinander mit demselben Script gemessen. Die abschließenden Vergleichsläufe erfolgen ohne gleichzeitig laufende Qualitätssuite oder Integrationstests.

Die Testdateien werden frisch geschrieben; dies bildet keinen Windows-Kaltstart oder Virenscanner ab. Pro 50 Dateien wird ein Unterordner verwendet. Jede Variante misst Neu-Upload und vollständiges Ersetzen; beim Ersetzen ist die Historie des ersten Durchgangs weiterhin vorhanden. Die neue Größe `submitSeconds` misst die Zeit bis zur vollständigen Einreihung; Transfers laufen dabei bereits parallel. Zusätzlich wird die Erkennung einmal mit pausierter Queue gemessen.

Das Script verwendet echte Engine, Journal, SFTP-Operationen und SHA-256-Prüfungen. Es bildet die JSON-Serialisierung der Queue-Oberfläche nach, führt aber keinen vollständigen VS-Code-/WinSCP-Geschwindigkeitsvergleich aus. Die Fensteraktualisierung wird separat mit gerenderter Oberfläche geprüft. Im schnellen Benchmark werden die Zielinhalte zusätzlich **außerhalb der gemessenen Uploadzeit** zurückgelesen und byteweise verglichen.

Die zusätzlichen 10 ms in den Latenzversuchen gelten pro SFTP-Methodenaufruf und sind keine gemessene Netzwerk-RTT. Alle Zeiten sind Einzelmessungen und keine Geschwindigkeitszusage für den Dev-Server.

| Szenario | 0.0.25 vollständig | 0.0.26 vollständig | 0.0.26 schnell |
| --- | ---: | ---: | ---: |
| 1.500 × 4 KiB, lokal, neu | 4,15 s | 4,78 s | 3,07 s |
| 1.500 × 4 KiB, lokal, ersetzen | 5,05 s | 4,04 s | 2,90 s |
| 200 × 4 KiB, +10 ms/Methodenaufruf, neu | 12,01 s | 8,00 s | 6,09 s |
| 200 × 4 KiB, +10 ms/Methodenaufruf, ersetzen | 8,72 s | 8,00 s | 5,90 s |
| 16 × 1 MiB, +10 ms/Methodenaufruf, neu | 2,47 s | 0,88 s | 0,69 s |
| 16 × 1 MiB, +10 ms/Methodenaufruf, ersetzen | 2,41 s | 0,80 s | 0,62 s |

Bei 1.500 Dateien sank die Einreihzeit während des Neu-Uploads von 337 ms auf 86 ms. Die kumulierte serialisierte Queue-Datenmenge sank von 82.52 MB auf 3.41 MB. Im unverzögerten Neu-Upload war die neue vollständige Prüfung in diesem Einzellauf insgesamt etwas langsamer; die Änderungen liefern keinen pauschalen Geschwindigkeitsfaktor für alle Dateigrößen.

[Rohdaten](SFTP-Performance-0.0.26.json).


Bei pausierter Queue dauerte die reine Einreihung von 1.500 Dateien auf der lokalen SSD in der Diagnose ungefähr 59 ms vorher und 35 ms nachher. Das allein reproduziert keine mehrsekündige Wartezeit auf dem Laptop des Benutzers. Die zusätzlichen Einzelabfragen sanken von 1.563 auf 63; die in der Verzeichnisauflistung ohnehin enthaltenen Dateimetadatenabfragen bleiben erhalten. Mit synthetisch zusätzlich 2 ms je redundanter Einzelabfrage lagen die Zeiten bei 4,25 s und 0,19 s. Dieser Belastungstest ist ausdrücklich keine Annahme über die lokale SSD des Benutzers.

## Reproduktion und Validierung

```sh
# Node gemäß .nvmrc, lokale SSH-Fixtures bereits gestartet
npm run benchmark:small
XSCP_BENCH_FILES=200 XSCP_BENCH_RPC_DELAY=10 npm run benchmark:small
XSCP_BENCH_FILES=16 XSCP_BENCH_BYTES=1048576 XSCP_BENCH_RPC_DELAY=10 npm run benchmark:small
XSCP_BENCH_VERIFICATION=size XSCP_BENCH_FILES=200 XSCP_BENCH_RPC_DELAY=10 npm run benchmark:small
XSCP_BENCH_DISCOVERY_ONLY=1 npm run benchmark:small
```

Für eine Ausgangsversion kann `XSCP_BENCH_SOURCE` auf einen separaten `src/`-Snapshot zeigen. Das Script nutzt auch die SSH-Erzeugung und Host-Key-Klasse dieses Snapshots. Testdateien und entfernte Testbäume werden je Lauf getrennt angelegt und wieder entfernt. Rohdaten erscheinen als JSON-Zeilen.

Validiert: 136 Unit-Tests, 11 Webview-Tests, 33 Protokolltests und 10 zusätzliche Integrationstests für Überwachung, Ausschlussregeln, Netzwerkverlust, vollen Datenträger und Finalisierungsabbruch; Übersetzungen, Lint, Syntaxprüfung und Build. Neue Tests decken kurze und vertauscht eintreffende SFTP-Antworten, begrenzte Parallelität, den schnellen Prüfmodus und seine Grenzen, erzwungene Vollprüfung bei Fortsetzung/Überwachung sowie kompakte Oberflächenmeldungen und Retry-IDs außerhalb der sichtbaren Historie ab.

Der Kandidat wird als VSIX gebaut und in einem isolierten VS-Code-Profil geprüft. Für diese Version liegen noch keine eigenen Windows-/Linux-Desktop-Messungen und kein direkter Vergleich mit WinSCP auf dem Dev-Server vor.
