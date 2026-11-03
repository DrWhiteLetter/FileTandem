# SFTP-Sammeluploads in 0.0.25

Stand: 3. November 2026. Ausgangsversion: 0.0.24, Commit `35428d0`.

Bei vielen kleinen Dateien dominierte neben den Serveranfragen die wiederholte Verarbeitung der gesamten Transferhistorie. Jede Aufnahme, jeder Start, Checkpoint und Abschluss löste eine vollständige Kopie der Queue, die Journalprojektion und eine Aktualisierung der Oberfläche aus. Der bisherige Dateitransfer öffnete außerdem separate SFTP-Kanäle für Metadaten und Streaming und schloss sie nach jeder Datei.

## Änderungen

- Vier parallele SFTP-Aufträge pro Server statt zwei. SCP und lokale Kopien bleiben bei zwei.
- Exklusive Wiederverwendung von Transferkanälen innerhalb derselben geprüften SSH-Verbindung. Jeder aktive Auftrag besitzt einen eigenen Kanal für Metadaten, Streaming und Prüfsummen. Browserkanäle bleiben unabhängig. Fehler und Abbruch verwerfen den betroffenen Kanal; nach 30 Sekunden Leerlauf sowie beim Beenden werden Kanäle geschlossen. Eine neue SSH-Verbindung übernimmt keine alten Kanäle.
- Upload-Baumerkennung benötigt keinen zusätzlichen SFTP-Kanal. Rechte und Zeitstempel werden mit einer SETSTAT-Anfrage gesetzt.
- Die VS-Code-Anbindung bündelt Queue-Snapshots in 100-ms-Abständen und veröffentlicht den Abschluss sofort. Das Journal projiziert seine erlaubten Felder erst beim Schreiben; signierte, atomare Speicherung und Wiederanlaufregeln bleiben erhalten. Elternaufträge werden direkt nach ID abgefragt.
- Vollständige SHA-256-Prüfung der Quelle und der übertragenen Teil-Datei, erneute Zielprüfung, Konfliktentscheidungen und sichere Veröffentlichung bleiben erhalten. Kein automatischer Retry und keine ungeprüfte Ersetzung.

## Messung

Echter SFTP-Testserver in der lokalen Colima-VM, macOS arm64, Node 22.13.1. Je 4 KiB pro Datei, 50 Dateien pro Unterordner; Neu-Upload und anschließende vollständige Ersetzung. Der Ersetzungslauf enthält auch die Historie des ersten Laufs. Original-Transferengine, Streams, Prüfsummen und signiertes Journal werden verwendet. Ein `JSON.stringify` der Queue pro Benachrichtigung bildet die Serialisierung für die Oberfläche nach; dies ist **kein vollständiger VS-Code-/Webview-Benchmark** und kein WinSCP-Vergleich. Einige Validierungstests liefen während der Ausgangsmessung parallel; die Werte sind orientierende Einzelmessungen, kein statistisch isolierter Vergleich.

| Szenario | 0.0.24 | 0.0.25 | Verhältnis |
| --- | ---: | ---: | ---: |
| 1.500 Dateien neu, lokaler Testserver | 60,46 s | 4,00 s | ca. 15× |
| 1.500 Dateien ersetzen, lokaler Testserver | 154,82 s | 4,67 s | ca. 33× |
| 200 Dateien neu, zusätzlich 10 ms je SFTP-Methodenaufruf | 18,46 s | 8,43 s | ca. 2,2× |
| 200 Dateien ersetzen, zusätzlich 10 ms je SFTP-Methodenaufruf | 19,51 s | 7,76 s | ca. 2,5× |

Die zusätzliche Verzögerung ist eine synthetische Verzögerung vor SFTP-Methodenaufrufen, **keine gemessene Netzwerk-RTT**. Sie zeigt, dass bei dominierender Server-/Netzwerklatenz ein kleinerer Geschwindigkeitsgewinn zu erwarten ist. Laufzeiten auf dem Dev-Server hängen von Dateigrößen, Latenz, Serverlast und bestehender Historie ab.

Beim 1.500-Dateien-Neu-Upload sinken die Kanalaufbauten von 3.032 auf 4 und die Queue-Snapshots von 6.504 auf 41. Die kumulierte JSON-Datenmenge der nachgebildeten Oberflächenaktualisierungen sinkt von 10,67 GB auf 78,84 MB. Dies sind **keine SSH-Nutzdatenmengen**. Beim direkten Ersetzungslauf werden die vier Kanäle weiterverwendet; kein neuer Kanalaufbau ist erforderlich. Alle Dateien erreichen `completed`; die von der Engine nach Zielprüfung gemeldeten SHA-256-Werte werden zusätzlich mit den erwarteten Inhalten verglichen.

[Rohdaten](SFTP-Performance-0.0.25.json).

## Reproduzieren

Lokale SSH-Fixtures gemäß [Fixture-Anleitung](../../test/fixtures/ssh/README.md) starten. Node aus `.nvmrc` verwenden:

```sh
npm run benchmark:small
XSCP_BENCH_FILES=200 XSCP_BENCH_RPC_DELAY=10 npm run benchmark:small
```

Ein separater Quellensnapshot kann über `XSCP_BENCH_SOURCE` ausgewählt werden; für die Ausgangsmessung wurde `src/` von Commit `35428d0` verwendet. Das Script erzeugt und entfernt ausschließlich seinen eigenen lokalen und entfernten Testbaum. Rohdaten werden als JSON-Zeilen ausgegeben. Ein Lauf darf nicht gleichzeitig mit Tests erfolgen, die SSH-Fixtures oder deren Host Keys neu starten.

## Validierung und Grenzen

- Qualitätssuite mit Übersetzungen, Lint, Syntaxprüfung, 126 Unit-Tests, 10 Webview-Tests und Build.
- Protokolltests einschließlich SFTP/SCP, Host-Key-Prüfung, Authentifizierung, Konflikten, Abbruch, Wiederaufnahme und Zugriff über die Browserdienste. Auth-/Host-Key-Tests mit `XSCP_DOCKER_CONTEXT=colima-xscp` ausgeführt.
- Automatische Uploadüberwachung: externe Änderungen, Konflikte und Stop während der Übertragung.
- Neue Regressionstests für exklusive Kanalnutzung, Wiederverwendung, Verbindungswechsel, Fehler, Abbruch, Leerlauf, Beenden während eines Kanalaufbaus sowie gebündelte Queue-Snapshots einschließlich abgebrochener Kindaufträge.
- Installierbares VSIX mit Paketprüfung und isoliertem VS-Code-Installationstest.

Die neue Version ist lokal auf macOS geprüft. Für diese Änderung liegt noch kein neuer Windows-/Linux-Desktop-Test vor. Große Einzeldateien verwenden weiterhin den bisherigen begrenzten Streaming-Puffer; die Messung hier betrifft viele kleine Dateien und Ordner.
