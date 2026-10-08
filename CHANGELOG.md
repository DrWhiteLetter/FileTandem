# Changelog

## 0.0.9 – 08.10.2026

- Einstellungen, Befehle, Ansichten und Editor-URIs auf `filetandem` umgestellt.
- Bestehende Einstellungen, Profile, Host-Key-Vertrauen und SecretStorage-Schlüssel werden innerhalb der bisherigen Extension-ID migriert; neue Werte haben Vorrang. Unterbrochene Transfers starten nicht automatisch.

## 0.0.8 – 08.10.2026

- Reproduzierbare M6-Regression mit isolierten VS-Code-Profilen, Mindestversion und Stable, installiertem SFTP/SCP, Editor, Remote-SSH, Restart, Reload und Restricted Mode.
- Echte TCP-Abbrüche, begrenztes Remote-Testdateisystem und lokales macOS-Testvolume für volle Datenträger; Prüfsummen und Erhalt bestehender Zieldateien.
- Performance-Harness für Dateien über 4 GiB, 1.000 kleine Dateien und 10.000 Verzeichniseinträge.
- Release-, Nutzungs- und Wartungsanleitung mit dokumentierten offenen Abnahmen. Juristisches Okay für den Produktnamen laut Benutzer dokumentiert.
- Weiterhin private Vorabversion; keine Windows-/Linux-Freigabe und keine Marketplace-Veröffentlichung.

## 0.0.7 – 08.10.2026

- Eigenes FileTandem-Logo und direkter Öffnen-Button in der Verbindungen-Ansicht.

## 0.0.6 – 08.10.2026

- Produktname FileTandem und Marketplace-Titel übernommen; MIT-Lizenz und Drittanbieterhinweise im Paket.

## 0.0.5 – 07.10.2026

- SFTP-Editor mit ausdrücklicher Schreibfreigabe, Auto Save nach Freigabe, Konfliktprüfung, Review und Diff.
- SCP-Dateien als private lokale Editorkopie mit ausdrücklichem Queue-Upload.
- Mehrere Sitzungen, interne Drag-and-drop-Transfers, virtualisierte Listen, Deutsch/Englisch und Theme-/Zoom-Abnahme.

## 0.0.2–0.0.4 – 07.10.2026

- SFTP-Dateiverwaltung, rekursive Übertragungen, Queue, Konfliktentscheidungen und Wiederherstellungsjournal.
- Echtes SCP ohne SFTP-Fallback; geprüfte SFTP-Fortsetzung und begrenzte Bereinigung eigener Teil-Dateien.

## 0.0.1 – 07.10.2026

- Installierbares Extension-Grundgerüst und technische Nachweise für lokalen Desktop-Zugriff, SSH-Host-Keys, Authentifizierung und beide Übertragungsprotokolle.
