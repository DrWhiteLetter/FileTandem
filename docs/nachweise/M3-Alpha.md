# SFTP-Alpha 0.0.3

## Installation und erster Test

1. VS Code Desktop ab 1.140.0 öffnen. Unter Erweiterungen → „Aus VSIX installieren…“ die Datei `out/xscp-0.0.3.vsix` auswählen und das Fenster neu laden.
2. In der xScp-Seitenleiste ein SFTP-Profil anlegen: Host, Port, Benutzer, Passwort oder Schlüsseldatei sowie lokale und entfernte Startordner. Einen neuen Host-Key anhand einer unabhängig bekannten Fingerprint-Angabe prüfen und bestätigen.
3. Profil öffnen. Lokal eine Datei oder einen Ordner markieren und „Hochladen →“ wählen; das Ziel ist der aktuell angezeigte Remote-Ordner. Alternativ „Dateien/Ordner hochladen“ oder im lokalen VS-Code-Explorer „xScp: Auswahl hochladen“ verwenden.
4. Remote markieren und „Download“ zum angezeigten lokalen Ordner oder „Download nach“ zur nativen Ordnerauswahl wählen. Bei Konflikten werden tatsächliches Ziel und die verfügbaren Optionen angezeigt: ersetzen, überspringen, beide behalten oder abbrechen. Eine Regel kann für weitere Konflikte desselben Sammelauftrags gelten.
5. Die Queue zeigt Fortschritt, Rate, Ergebnis und Fehler. „xScp: Transfers anzeigen“ öffnet die globale Ansicht. Pause verhindert neue Starts; aktive Transfers laufen weiter. Abbruch betrifft den gewählten Auftrag. Retry startet neue Versuche für fehlgeschlagene/abgebrochene/unterbrochene Aufträge und wiederholt keine erfolgreichen Dateien.
6. Commander-Tabs können während Transfers geschlossen werden. Nach einem VS-Code-Neustart bleiben Erfolge erhalten; offene Aufträge heißen „unterbrochen“. Verbindung bewusst herstellen und die gewünschten Aufträge erneut starten. Es gibt keinen automatischen Schreibvorgang und kein Byte-Resume.

## Geprüft

Am 07.10.2026 unter macOS arm64, Node 22.13.1 und VS Code 1.140.0: fünf echte SFTP-Tests gegen eigene isolierte OpenSSH-Container, darunter SFTP-only ohne Shell, Passwort und verschlüsselter Ed25519-Key, binäre Hash-Rundläufe, 16-MiB-Streaming mit maximal 64-KiB-Chunks, paralleles Browsen, Abbruch ohne Verlust des alten Ziels, alle Konfliktentscheidungen, Namenskollisionen, verschachtelte/leere Ordner und übersprungene Symlinks. Zwei normale VS-Code-Starts mit frisch installierter VSIX prüfen den tatsächlichen Webview-Handshake, Upload nach Tab-Schließen, rekursiven Rundlauf, Journalpersistenz und expliziten einzelnen Retry nach Neustart. Unit-/DOM-Tests und Paketinspektion ergänzen diese Abnahme. Kein produktiver Server wurde verwendet.

## Grenzen

- M3 überträgt über SFTP. Echtes SCP und geprüfter Wiederanlauf folgen in M4; Editorintegration und zusätzliche Bedienung in M5.
- Zwei aktive Aufträge pro Server, 1.000 ausgewählte Wurzeln, maximal 10.000 Einträge je entdecktem Baum und Tiefe 100. Die Queue zeigt die letzten 200 Zeilen. Journal: maximal 10.000 Aufträge / 32 MiB; ein Schreibfehler oder die Überschreitung wird gemeldet. Weitere Transfers bleiben möglich, ihre Neustart-Historie kann dann fehlen.
- Symlinks und Spezialdateien werden übersprungen. Dateien übernehmen normale Rechte und Änderungszeit ohne setuid/setgid oder Eigentümerwechsel; neu angelegte Ordner behalten sichere Standardrechte. Windows-/Linux-, Theme-/Tastatur- und große Lastabnahmen sowie gehostete CI bleiben für M5/M6 offen.
- Erst eine vollständige, erneut nach SHA-256 geprüfte Teil-Datei wird veröffentlicht. Fehler/Abbruch können eigene `.xscp-<ID>.part`-Dateien hinterlassen; sie werden weder blind fortgesetzt noch fremde Dateien gelöscht. Ein Retry verwendet eine neue ID und beginnt vollständig neu.
- Remote-Ersetzen benötigt OpenSSH `posix-rename`; andernfalls bleibt das vorhandene Ziel erhalten und die UI bietet Alternativen. Neue lokale Ziele benötigen Hardlinks im Ziel-Dateisystem; fehlende Unterstützung führt zum sicheren Fehler. Hash und Rename bestätigen keine dauerhafte Speicherung nach einem Server-Stromausfall.
- Änderungen am Ziel während der Übertragung werden vor Veröffentlichung geprüft. OS-/SFTP-APIs bieten keinen atomaren Vergleich mit anschließendem Rename gegen fremde gleichzeitige Schreiber. Dieses verbleibende Zeitfenster ist kein transaktionaler Schutz gegen externe Prozesse. Sperren koordinieren die eigenen xScp-Aufträge anhand ihrer Zielpfade; externe Schreiber und verschiedene Pfad-Aliase werden dadurch nicht ausgeschlossen.
- Schnellverbindungen bleiben flüchtig. Ihre Journaleinträge sind sichtbar, nach einem Neustart ist für neue Transfers ein gespeichertes Profil erforderlich.
