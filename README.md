# FileTandem

**Version 1.0.0** · SFTP- und SCP-Dateimanager für VS Code Desktop · MIT-Lizenz

Lokale Dateien und Serverdateien nebeneinander – direkt in Visual Studio Code. Mit FileTandem verwaltest du Dateien über **SFTP und SCP**, überträgst ganze Ordner und bearbeitest Remote-Dateien im Editor.

**[Aktuelle Version herunterladen](https://github.com/DrWhiteLetter/FileTandem/releases/latest)** · [Änderungen](CHANGELOG.md) · [Fehler melden](https://github.com/DrWhiteLetter/FileTandem/issues)

![FileTandem: lokale und entfernte Dateien mit Transferübersicht](media/filetandem-screenshot.png)

*Die Ansicht zeigt Beispieldaten.*

## Was kann FileTandem?

- Zwei Dateibereiche mit Filtern, Sortierung, Mehrfachauswahl und Pfadfavoriten.
- Ohne Serverprofil zwei lokale Ordner unabhängig öffnen und Dateien oder Ordner in beide Richtungen kopieren.
- Dateien und Ordner hoch- und herunterladen, mit Fortschrittsanzeige, aufräumbarem Transferverlauf und geprüfter SFTP-Fortsetzung.
- Serverprofile speichern; Anmeldung per Passwort, SSH-Schlüssel oder SSH-Agent.
- Remote-Dateien öffnen, Änderungen vergleichen und Bearbeitung gezielt freigeben.
- Ordner mit Vorschau abgleichen oder lokale Änderungen automatisch hochladen.
- Ausschlussregeln für Dateiendungen, Namen und Punktdateien; Remote-Löschsicherungen als `.bak`.
- Deutsche und englische Oberfläche passend zur VS-Code-Anzeigesprache, helle und dunkle Themes.

## Installation

1. Unter **[Releases](https://github.com/DrWhiteLetter/FileTandem/releases/latest)** die Datei `FileTandem-<Version>.vsix` herunterladen.
2. In VS Code die **Erweiterungen** öffnen und im Menü **… → Aus VSIX installieren …** die Datei auswählen.
3. Über die Befehlspalette **FileTandem: Dateimanager öffnen** starten.

Benötigt **VS Code Desktop ab 1.140.0**. Node.js ist für die Installation nicht nötig. Die Veröffentlichung erfolgt als VSIX über GitHub Releases; eine Veröffentlichung im VS Code Marketplace ist nicht Bestandteil dieses Releases.

### Getestete Desktop-Umgebungen

| Plattform | Nachweis |
| --- | --- |
| macOS mit Apple Silicon | Automatisierte lokale Release- und Installationstests; Details im [Release-Nachweis](docs/nachweise/Release-1.0.0.md). |
| Windows | Erfolgreicher manueller Desktop-Test, vom Projektinhaber bestätigt. OS-/VS-Code-Version und Architektur wurden nicht gesondert dokumentiert. [Nachweis](docs/nachweise/Windows-Desktop.md). |
| Debian 13.7, Xfce, ARM64 | Erfolgreicher manueller Test mit VS Code 1.145.0 (`code_1.145.0-1793748906_arm64.deb`), vom Projektinhaber bestätigt. [Nachweis](docs/nachweise/Linux-Desktop.md). |

Diese Nachweise sind keine Zusage für jede Distribution, Architektur oder Remote-Umgebung. macOS Intel, weitere Linux-Desktops sowie spezielle WSL-/Container-/UNC-Kombinationen sind nicht pauschal abgenommen. Eine vollständige manuelle Screenreader-Abnahme steht noch aus.

## Lokal arbeiten

**Lokalen Dateimanager öffnen** zeigt zwei lokale Ordner. Öffne links und rechts die gewünschten Pfade, markiere Dateien oder Ordner und wähle **Kopieren →** beziehungsweise **← Kopieren**. Kontextmenü und Drag-and-drop funktionieren ebenfalls; bei aktivierten Commander-Tasten kopiert F5 die Auswahl in den gegenüberliegenden Ordner. Bestehende Zieldateien verwenden die normalen Konfliktdialoge.

## Erste Verbindung

1. Über die Befehlspalette **FileTandem: Profil anlegen** ein Serverprofil mit Host, Benutzer und Anmeldeverfahren erstellen. Danach im Dateimanager **Profil verbinden** wählen.
2. Beim ersten Verbinden den angezeigten SSH-Fingerprint unabhängig beim Hoster oder Administrator prüfen und bestätigen.
3. Links den lokalen Ordner, rechts den Serverordner öffnen. Dateien auswählen und mit **Hochladen →** oder **← Herunterladen** übertragen.

Für SFTP genügt ein SFTP-Zugang; ein VS Code Server ist nicht erforderlich. SCP benötigt einen GNU/Linux-Server mit Shell und installiertem `scp`.

**Bitte beachten:** Remote-Löschungen werden standardmäßig als `.bak` gesichert. Bei Websites den Download solcher Sicherungen im Webserver sperren. **Remote-Ordner aktuell halten …** spiegelt den lokalen Ordner einschließlich Entfernungen; ausgeschlossene Dateien und Sicherungen bleiben erhalten. Prüfe die Zielordner vor dem Start. [Ausschlüsse und Sicherungen](docs/ausschlussregeln-und-sicherungen.md) · [Automatischer Upload](docs/automatischer-upload.md).

## Mitentwickeln

Mit Node.js ab 22.13.1 und npm:

```sh
npm ci
npm start
```

[Hinweise zur Mehrsprachigkeit](docs/mehrsprachigkeit.md).

`npm run quality` prüft den Code und baut die Erweiterung. `npm run package` erstellt die installierbare VSIX unter `out/`.

## Bilder öffnen

Bilder (JPG/JPEG, PNG, GIF, WebP, BMP und ICO) öffnet FileTandem in der
Bildvorschau von VS Code. Lokale Bilder werden direkt gelesen. Remote-Bilder
werden über SFTP oder SCP in einen privaten System-Tempordner
(`filetandem-preview-*`) heruntergeladen und schreibgeschützt angezeigt.
Die Kopie wird beim Schließen des Bild-Tabs oder beim regulären Beenden der
Erweiterung entfernt. Nach einem Absturz können temporäre Dateien verbleiben.
Es erfolgt kein automatischer Rückupload. Oberhalb von 10 MiB wird stattdessen
ein normaler Download angeboten.

## Viele Dateien per SFTP hochladen

Ab 0.0.26 werden Queue und Dateilisten sparsamer aktualisiert und SFTP-Datenblöcke parallel übertragen. Unter **Einstellungen → FileTandem → Sicherheitsfeatures → SFTP Upload Verification** (`filetandem.sftpUploadVerification`) stehen zwei Prüfmodi zur Wahl:

- **`sha256`** (optional): Hochgeladene Teil-Datei vollständig zurücklesen und ihren SHA-256-Wert vergleichen.
- **`size`** (schnell, Voreinstellung): SSH-Transport, Quellenkonsistenz und Dateigröße prüfen, anschließend sicher veröffentlichen. Der gespeicherte Serverinhalt wird nicht per Prüfsumme kontrolliert. Die Queue kennzeichnet diese Abschlüsse mit „SSH + Größe geprüft“.

Die Auswahl gilt für neu startende Dateien manueller SFTP-Uploads, auch beim manuellen Ordnerabgleich. Fortsetzungen, automatische Überwachung und geprüfte Editor-Uploads verwenden immer SHA-256. Downloads, SCP und lokale Kopien behalten ihre vollständige Prüfung.

[Messungen, Grenzen und Recherche](docs/nachweise/SFTP-Performance-0.0.26.md).

## Transferverlauf aufräumen

In der aufgeklappten Transferliste blendet **Erfolgreiche entfernen** abgeschlossene Einträge direkt aus. **Transferverlauf leeren …** entfernt nach Bestätigung auch fehlgeschlagene, abgebrochene, unterbrochene und übersprungene Einträge aus der Anzeige. Laufende und wartende Transfers bleiben erhalten. Die Änderung gilt für das aktuelle Profil in allen Sitzungen und wird gespeichert.

Dateien und Teil-Dateien werden nicht gelöscht. Für ausgeblendete Einträge stehen Wiederholung und Teil-Dateibereinigung nicht mehr in der Oberfläche zur Verfügung; bei Bedarf vorher bereinigen. Interne Auftragsdaten bleiben für Ordnerabhängigkeiten und Transferfortschritt im Journal erhalten; diese Funktion gibt keinen Journalspeicher frei.

## Support und Sicherheit

Fehler und Verbesserungsvorschläge bitte über [GitHub Issues](https://github.com/DrWhiteLetter/FileTandem/issues) melden. Nenne FileTandem-Version, Betriebssystem, Architektur, VS-Code-Version, Protokoll und reproduzierbare Schritte. Zugangsdaten, private Schlüssel und unbereinigte Transferjournale gehören nicht in Issues.

Für vertrauliche Sicherheitsmeldungen siehe [SECURITY.md](SECURITY.md). Bekannte Funktionsgrenzen und Installationshinweise stehen in der [Bedienungsanleitung](docs/release-anleitung.md).

## Unterstützen & Lizenz

FileTandem hilft dir? [Unterstütze die Weiterentwicklung über PayPal](https://paypal.me/TobiasKohlhepp).

[MIT-Lizenz](LICENSE) · [Drittanbieterhinweise](THIRD_PARTY_NOTICES.md)
