# First transfer: a 10-minute test / Erster Transfer: 10-Minuten-Test

Use a test directory and disposable files. Keep production data out of this first test.
Verwende einen Testordner und entbehrliche Dateien.

## English

1. Note your FileTandem version, VS Code version, OS and architecture.
2. Create an SFTP profile, choose the start folders and connect. Verify the host fingerprint independently.
3. Upload a small text file to the test directory. Is the direction and destination clear? Check the completed transfer and the remote file.
4. Download it into a different local test directory and compare the contents.
5. Open the remote file. It starts read-only. Enable editing, make a small change and save. SFTP saves directly to the server, including Auto Save. With SCP, upload the edited local copy explicitly.
6. Record where you hesitated, what you expected and what happened. Stop any monitoring you started and disconnect afterwards.

The README's 27-second montage shows a connected session, selecting and uploading a file, then opening and enabling the remote editor. It contains cuts, uses a German UI and comes from the 1.0.1 test-server recording; it is not a continuous timed benchmark.

Report: Did the first connection work? Did upload/download work? Was editing understandable? Would you use this again, and for what task? Screenshots are optional; remove hostnames, usernames and sensitive paths. Never include passwords, keys or profile exports.

[First-transfer feedback](https://github.com/DrWhiteLetter/FileTandem/issues/new?template=first-transfer.yml) · [Bug report](https://github.com/DrWhiteLetter/FileTandem/issues/new?template=bug-report.yml)

## Deutsch

1. FileTandem-Version, VS-Code-Version, Betriebssystem und Architektur notieren.
2. SFTP-Profil anlegen, Startordner wählen und verbinden. Host-Fingerprint unabhängig prüfen.
3. Kleine Textdatei in den Testordner hochladen. Sind Richtung und Ziel klar? Transferergebnis und Datei auf dem Server prüfen.
4. In einen anderen lokalen Testordner herunterladen und Inhalt vergleichen.
5. Remote-Datei öffnen, Bearbeitung gezielt freigeben, eine kleine Änderung speichern. SFTP speichert direkt auf dem Server, auch bei Auto Save. Bei SCP die bearbeitete lokale Kopie ausdrücklich hochladen.
6. Unklare Stellen mit Erwartung und tatsächlichem Verhalten notieren. Eventuell gestartete Überwachung beenden und Verbindung trennen.

Die 27-Sekunden-Montage in der README zeigt Ausschnitte zur verbundenen Sitzung, zum Upload und zum Remote-Editor aus der Testserver-Aufnahme von Version 1.0.1. Sie enthält Schnitte und ist keine durchgehende Zeitmessung.

Rückmeldung: Hat die erste Verbindung funktioniert? Upload und Download? War die Bearbeitung verständlich? Würdest du FileTandem wieder verwenden, und wofür? Die oben verlinkten Formulare können auf Deutsch ausgefüllt werden. Keine Passwörter, Schlüssel, Profil-Exporte oder unbereinigten Logs anhängen.
