# Version 0.0.4 – SFTP, SCP und sicherer Wiederanlauf

## Aktualisieren und ausprobieren

In VS Code Desktop ab 1.140.0 unter Erweiterungen → „Aus VSIX installieren…“ die Datei `out/xscp-0.0.4.vsix` auswählen und das Fenster neu laden. Bestehende Profile bleiben erhalten. „xScp: Dateimanager öffnen“ oder ein Profil in der xScp-Seitenleiste öffnen.

SFTP bleibt die empfohlene Voreinstellung. Für einen Server ohne SFTP ein eigenes Profil mit Protokoll **scp** anlegen. Commander, Upload/Download, Ordner, Konflikte und Dateioperationen verwenden dann ausdrücklich SCP und Shell-Werkzeuge. Es gibt keinen stillen Protokollwechsel. Auf dem Server werden eine POSIX-Shell, `scp` und GNU-Werkzeuge benötigt: find, stat, mv, ln, chmod, touch, rm, rmdir, mkdir und sha256sum. Fehlende Werkzeuge werden erklärt. Leerzeichen, Quotes und Shellzeichen bleiben literal; Steuerzeichen, Backslashes und ungültige SCP-Namen werden früh abgewiesen. Symlinks werden bei rekursiven Transfers übersprungen.

## Nach einem Abbruch oder Neustart

„xScp: Transfers anzeigen“ öffnet die globale Queue. Ein Neustart verbindet nicht automatisch und startet weder Übertragungen noch Bereinigungen.

- **Geprüft fortsetzen:** Für einen fehlgeschlagenen/abgebrochenen/unterbrochenen SFTP-Dateiauftrag mit zugeordneter eigener Teil-Datei. Quelle, vollständige Prüfsumme, vorhandener Datei-Anfang und unverändertes Ziel werden geprüft. Erst danach werden die fehlenden Bytes geschrieben. Bei einer Abweichung bleibt die Teil-Datei erhalten und ein vollständiger Neustart wird verlangt.
- **Vollständig neu starten:** Neuer Versuch mit neuer Teil-Datei. Erfolgreiche Dateien werden nicht automatisch wiederholt. SCP beginnt die Datei immer vollständig neu. Bei Ordnerfehlern auch den fehlgeschlagenen Elternauftrag auswählen; die Sammelaktion berücksichtigt die passenden Abhängigkeiten.
- **Teil-Datei bereinigen:** Zeigt den genauen eigenen Pfad zur nativen Bestätigung. Die Bereinigung betrifft ausschließlich eine zugeordnete eigene Teil-Datei; das endgültige Ziel bleibt erhalten. Remote-Bereinigung setzt eine passende bestehende Verbindung voraus. Geänderte Profile oder ersetzte Teil-Datei-Typen blockieren sie.

Retry/Fortsetzung kann auf ausdrücklichen Benutzerwunsch eine passende Verbindung wiederherstellen und die Anmeldung erneut abfragen. Geänderte Host-/Benutzer-/Protokollidentitäten erfordern einen neuen Auftrag. Alte M3-Historie bleibt lesbar, bietet aber ohne Quellen-/Teil-Datei-Zuordnung keine geprüfte Fortsetzung. Schnellverbindungen sind flüchtig; nach Neustart ein gespeichertes Profil für neue Aufträge verwenden.

## Weitere Anmeldung

Bei „Profil anlegen/bearbeiten“ stehen Passwort, SSH-Schlüssel, SSH-Agent und **Interaktive Anmeldung (z. B. Passwort / MFA)** zur Auswahl. Interaktive Serverabfragen erscheinen erst nach Host-Key-Prüfung als native Eingaben. Verdeckte Antworten bleiben verdeckt; mehrere Abfragerunden und Abbruch werden unterstützt. Diese Antworten werden nicht gespeichert oder protokolliert und nicht aus einem gespeicherten Passwort übernommen.

Agent: Unter macOS/Unix den expliziten eigenen SSH-Agent-Socket auswählen/bestätigen. Schlüssel bleiben beim Agent; Agent Forwarding ist aus. Unter Windows ist nur der OpenSSH-Agent-Named-Pipe-Weg vorgesehen; seine reale Plattformabnahme steht noch aus. Pageant/Cygwin sind nicht paketiert.

## Geprüfte Grenzen

macOS arm64 und VS Code 1.140.0 sind lokal abgenommen; Windows/Linux-Desktop, vollständige Bedien-/Theme-Matrix und gehostete CI bleiben M5/M6. Das ist eine private Entwicklungs-VSIX, kein öffentliches 1.0-Release.

Streaming verwendet 64-KiB-Blöcke. SCP akzeptiert sichere ganzzahlige Dateigrößen einschließlich über 4 GiB; der tatsächliche Über-4-GiB-Lasttest bleibt M6-04. Exec hat eine Inaktivitätsgrenze (Metadaten normalerweise 30 Sekunden, Transfers/Hashprüfung 5 Minuten), keinen festen Gesamtdauerabbruch solange Datei-Daten fortschreiten. GNU-stat liefert hier Änderungszeiten in Sekunden.

Die Sicherheitsprüfungen lesen Inhalte zusätzlich vollständig bzw. als Präfix. Besonders bei SFTP-only sind dafür weitere Leseübertragungen nötig; Fortsetzung spart das erneute Schreiben vorhandener Bytes und verspricht keine pauschale Zeit-/Bandbreitenersparnis.

Zwei aktive Aufträge pro Server; 1.000 ausgewählte Wurzeln; maximal 10.000 Einträge pro Transferbaum und Tiefe 100. SCP-Auflistung: maximal 32 MiB/10.000 Einträge. Queue-Anzeige: letzte 200 Zeilen. Journal: maximal 10.000 Aufträge/32 MiB; Schreibfehler werden gemeldet. Das Journal enthält Transfermetadaten und Inhalts-Hashes, keine Anmeldung; ein HMAC-Schlüssel in VS-Code-SecretStorage schützt vor Manipulation. Beschädigte Journale werden separat aufbewahrt und lösen keine Dateioperationen aus.

Teil-Dateien liegen im Zielordner. Neue lokale/SCP-Ziele benötigen Hardlink-Unterstützung; sicheres SFTP-Ersetzen benötigt OpenSSH-posix-rename. Normale Dateirechte und Änderungszeit werden übernommen, setuid/setgid und Eigentümer nicht. OS-/SFTP-/Shell-Pfadoperationen bieten keinen atomaren Vergleich mit anschließendem Rename gegen externe Schreiber; xScp-Sperren koordinieren die eigenen Zielpfade, nicht fremde Prozesse oder verschiedene Pfad-Aliase. Hash/Rename bestätigt keine Speicherung nach einem Server-Stromausfall. Eigene verwaiste Partials ohne gültige Zuordnung werden niemals automatisch gelöscht.
