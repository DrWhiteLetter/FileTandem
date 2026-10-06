# xScp – Recherche und Umsetzungsplan

Stand: 6. Oktober 2026. Projektverzeichnis bei der Recherche leer. Dieses Dokument beschreibt einen Vorschlag; es wurde noch keine Anwendung implementiert. Aufwand und Plattformuntergrenze sind Planungsannahmen.

## 1. Produktziel

Eine native macOS-Anwendung für Dateiübertragungen über SFTP und echtes SCP. WinSCP-Nutzer erkennen die räumliche Organisation und Arbeitsabläufe wieder; Darstellung, Auswahlverhalten, Menüführung und Systemintegration folgen macOS.

Empfehlung: Commander-Ansicht als einzige Hauptansicht der ersten Version, Swift mit AppKit und ergänzend SwiftUI, SFTP als Standard. Arbeitstitel: xScp. Vorgeschlagene Mindestversion: macOS 14; Prüfung auf Mindestversion und aktueller stabiler macOS-Version. Apple Silicon zuerst, Intel-Unterstützung vor Release anhand des Bedarfs entscheiden.

## 2. Recherche: Was WinSCP ausmacht

WinSCP bietet eine Commander- und eine Explorer-Oberfläche. Commander zeigt lokale Dateien links und entfernte Dateien rechts; Explorer nur die entfernte Seite. Für dieses Projekt ist Commander die passende Referenz. [WinSCP: Oberflächen](https://winscp.net/eng/docs/interfaces)

Die dokumentierte Commander-Oberfläche organisiert Werkzeugleisten und Sitzungstabs oberhalb zweier Dateibereiche. Jeder Bereich besitzt Pfadanzeige, Navigation, Dateiliste und Statusinformationen. Verzeichnisbäume und eine Kommandozeile sind optional. Unterhalb liegt die einblendbare Transferwarteschlange. Die Bedienung ist stark tastaturorientiert. Diese Anordnung ist der wesentliche Wiedererkennungsfaktor. [WinSCP: Commander-Hauptfenster](https://winscp.net/eng/docs/ui_commander)

Die Dateilisten unterstützen unter anderem Sortierung, Filter, Mehrfachauswahl sowie Spalten für Name, Größe, Typ, Änderungsdatum und Attribute. Werkzeugleisten lassen sich anpassen. Für xScp übernehmen wir die Informationsdichte der Listen und reduzieren die Anzahl ständig sichtbarer Werkzeuge. [WinSCP: Menü](https://winscp.net/eng/docs/ui_commander_menu), [Werkzeugleisten](https://winscp.net/eng/docs/ui_toolbars)

WinSCPs Transferliste zeigt Aufträge mit Quelle, Ziel, Fortschritt und Status; laufende Dateiübertragungen erhalten unter anderem Geschwindigkeitsangaben. Das erleichtert Arbeiten während längerer Transfers. [WinSCP: Warteschlange](https://winscp.net/eng/docs/ui_queue)

Zum erweiterten Funktionsumfang gehören Dateibearbeitung, Verzeichnissynchronisierung und das automatische Hochladen lokaler Änderungen. Diese Funktionen sind sinnvoll für spätere Versionen, aber keine Voraussetzung für die erste Transfer-App. [WinSCP: Bearbeiten](https://winscp.net/eng/docs/task_edit), [Synchronisieren](https://winscp.net/eng/docs/task_synchronize)

## 3. Gestaltung für macOS

Apple empfiehlt übersichtliche Werkzeugleisten und konsistente Standard-Tastenkürzel. Daraus folgt für xScp: wenige häufig benötigte Aktionen im Fenster, alle Aktionen zusätzlich über Menüs und vollständige Tastaturbedienung. [Apple: Toolbars](https://developer.apple.com/design/human-interface-guidelines/toolbars), [Apple: Keyboards](https://developer.apple.com/design/human-interface-guidelines/keyboards/)

| WinSCP-Vertrautheit | Geplante Umsetzung auf dem Mac |
| --- | --- |
| Lokal links, Server rechts | Zwei gleichwertige, horizontal nebeneinanderliegende Dateibereiche mit verschiebbarer Trennlinie |
| Sitzungstabs | Native Fenstertabs für mehrere Verbindungen; pro Tab eigenes lokales und entferntes Verzeichnis |
| Detaillierte Dateilisten | Native Tabellen mit sortierbaren und veränderbaren Spalten, Systemschrift und Dateisymbolen |
| Navigation pro Seite | Zurück/vorwärts, übergeordneter Ordner, anklickbarer Pfad und direkt eingebbarer Pfad |
| Häufige Transferaktionen | Beschriftete Aktionen „Hochladen“ bzw. „Herunterladen“, abhängig vom aktiven Bereich |
| Transferliste unten | Einklappbarer unterer Bereich mit Gesamt- und Dateifortschritt |
| Windows-Menüs im Fenster | Globale macOS-Menüleiste, native Titelleiste und Fensterknöpfe |
| Funktionstasten | Optionales Commander-Profil zusätzlich zu den regulären Mac-Befehlen |

Weitere Gestaltungsentscheidungen: SF Symbols für Aktionen, systemgesteuerte Farben und Materialien, Hell-/Dunkelmodus, klare Fokusmarkierung, native Kontextmenüs und Sheets. Eine zusätzliche Favoriten-Seitenleiste bleibt standardmäßig geschlossen, damit das bekannte Zwei-Bereiche-Layout dominiert.

Geplante Anordnung:

```text
┌─────────────────────────────────────────────────────────────────┐
│ ● ● ●  xScp     Verbinden   Übertragen   Neuer Ordner   Transfers │
├─────────────────────────────────────────────────────────────────┤
│ Verbindung 1                    │ Verbindung 2                  │
├─────────────────────────────────┬───────────────────────────────┤
│ Lokal                           │ user@server · SFTP            │
│ ‹ › ↑  /Users/name/Projects      │ ‹ › ↑  /var/www               │
├─────────────────────────────────┼───────────────────────────────┤
│ Name       Größe       Geändert │ Name       Größe     Geändert │
│ 📁 assets                       │ 📁 assets                     │
│    index.html                   │    index.html                 │
│                                 │                               │
├─────────────────────────────────┼───────────────────────────────┤
│ 12 Objekte · 2 ausgewählt        │ 18 Objekte                    │
├─────────────────────────────────┴───────────────────────────────┤
│ Transfers · 2 aktiv, 4 wartend                                   │
│ index.html   → server:/var/www   ███████░░░  70 %   Abbrechen     │
└─────────────────────────────────────────────────────────────────┘
```

Die Skizze zeigt nur die Informationsarchitektur, kein fertiges visuelles Design. Transferaktionen zeigen vor Ausführung Richtung und konkretes Ziel. Doppelklick öffnet Ordner; ein Datei-Doppelklick löst zunächst keinen überraschenden Upload aus.

Tastatur: ⌘A auswählen, Return umbenennen, ⇧⌘N neuer Ordner, ⇧⌘G zum Pfad, ⌘, Einstellungen und ⌘W Tab/Fenster schließen. Lokales Löschen über ⌘⌫ verschiebt in den Papierkorb. Entferntes Löschen benennt ausdrücklich die endgültige Wirkung und fragt nach. Tab folgt standardmäßig der nativen Fokusnavigation. Das optionale Commander-Profil kann F5 für Übertragen und F7 für neuen Ordner anbieten; Systemkürzel werden nicht überschrieben. Vollständige Tastatursteuerung und VoiceOver sind Abnahmekriterien.

## 4. Umfang der ersten Version

### Verbindungen

- Verbindungsdialog mit Protokoll, Host, Port, Benutzer und optionalen Startverzeichnissen.
- Gespeicherte Serverprofile, Schnellverbindung und Wiederverbinden.
- Passwort, verschlüsselte SSH-Schlüssel und SSH-Agent; Keyboard-Interactive für entsprechende Serveranmeldungen.
- Host-Key-Prüfung vor Authentifizierung: unbekannten Schlüssel mit SHA-256-Fingerprint bestätigen, geänderten Schlüssel blockieren und eine bewusste Aktualisierung verlangen.
- Passwörter und gespeicherte Passphrasen ausschließlich im macOS-Schlüsselbund; Profile enthalten nur Referenzen. Private Schlüssel nicht ungefragt kopieren.
- Verständliche Zustände für Verbinden, Authentifizieren, Verbunden, Getrennt und Fehler.

### Dateiverwaltung

- Lokale und entfernte Verzeichnisse auflisten, navigieren, aktualisieren und nach Namen filtern.
- Sortierung, Mehrfachauswahl, versteckte Dateien, Pfad kopieren und Pfadfavoriten.
- Ordner anlegen, umbenennen, löschen und Eigenschaften anzeigen; entfernte Unix-Rechte bearbeiten, sofern unterstützt.
- Symlinks sichtbar kennzeichnen. Rekursive Transfers folgen Links nicht stillschweigend; zunächst überspringen und im Ergebnis ausweisen.
- Finder-Integration für lokale Dateien und Upload per Drag-and-drop; Download per Drag-and-drop in Finder über Dateiversprechen.

### Transfers

- Upload und Download von Dateien und rekursiven Ordnern über beide Protokolle.
- Warteschlange mit Richtung, Quelle, Ziel, Bytes, Geschwindigkeit, Fortschritt, Fehlern, Abbrechen und erneutem Versuch.
- Begrenzte Parallelität, zunächst zwei Transfers pro Server; Browser bleibt bedienbar.
- Konfliktdialog: Ersetzen, Überspringen, beide behalten und Abbrechen; Entscheidung optional auf den Auftrag anwenden.
- Übertragung ohne automatische Text-/Zeilenendenkonvertierung. Änderungszeiten nach Möglichkeit erhalten.
- Temporäre Zieldateien; erst nach erfolgreichem Abschluss umbenennen. Wenn sichere Ersetzung nicht unterstützt wird, verständlich darauf reagieren und vorhandene Dateien nicht vorzeitig entfernen.
- SFTP-Wiederaufnahme nur nach Prüfung von Quelle und Teil-Datei. SCP-Aufträge beginnen nach Abbruch erneut; kein Resume-Versprechen.
- Ein pausierter Warteschlangenstart stoppt neue Aufträge. Aktive SCP-Transfers erhalten eine Abbruchfunktion, keine irreführende Pause/Fortsetzen-Funktion.
- Teilfehler pro Datei ausweisen; ein Auftrag gilt nur als erfolgreich, wenn alle zugehörigen Transfers erfolgreich abgeschlossen sind.

### Nach der ersten Version

Verzeichnisvergleich und Synchronisierung mit Vorschau, Remote-Dateien extern bearbeiten und kontrolliert zurückladen, Quick Look für entfernte Dateien, SSH-Konfigurationsimport, Jump Hosts, Terminalintegration, Automation und weitere Protokolle. Ein eingebauter Editor, Explorer-Modus und Server-zu-Server-Transfers sind nicht Teil des MVP.

## 5. SFTP und SCP technisch sauber trennen

SFTP unterstützt strukturierte Dateisystemoperationen. SCP selbst überträgt lediglich Dateien; die entfernte Dateiverwaltung benötigt zusätzliche Shell-Funktionen. WinSCP weist auf diese Zusatzanforderungen ausdrücklich hin. [WinSCP: SCP](https://winscp.net/eng/docs/scp), [Protokollvergleich](https://winscp.net/eng/docs/protocols)

Außerdem verwendet das heutige OpenSSH-Kommando `scp` standardmäßig SFTP. Bei einem CLI-basierten Prototyp müsste `scp -O` verwendet werden, um tatsächlich das alte SCP-Protokoll zu testen. Ein erfolgreicher gewöhnlicher `scp`-Aufruf wäre kein SCP-Kompatibilitätsnachweis. [OpenSSH: scp-Handbuch](https://man.openbsd.org/scp)

Geplante Umsetzung:

- SFTP-Backend für Browsing, Metadaten und Transfers ohne benötigten Shell-Zugang.
- SCP-Backend für echte SCP-Transfers plus separates SSH-Exec-Backend für Verzeichnisoperationen.
- SCP-MVP unterstützt zunächst Linux mit POSIX-Shell und den im Technik-Prototyp festgelegten GNU-Werkzeugen. BSD/macOS-Server und BusyBox erst nach eigenen Kompatibilitätstests zusagen.
- Fähigkeiten beim Verbindungsaufbau erkennen. Fehlt die benötigte Shell-Umgebung, präzise Fehlermeldung; kein stiller Protokollwechsel.
- Kein gewöhnliches menschenlesbares `ls -l` als universelles Datenformat auswerten. Für unterstützte Server NUL-getrennte, definierte Metadatenausgabe verwenden; unbekannte Umgebungen als nicht unterstützt behandeln.
- Remote-Pfade konsequent quoten; Zeilenumbrüche und andere durch den SCP-Übertragungsweg nicht sicher unterstützte Namen explizit ablehnen. Empfangene Dateinamen und Zielpfade gegen Traversal und unerwartete Dateien prüfen.

## 6. Architekturvorschlag

**Native Oberfläche:** Swift, AppKit für Hauptfenster, NSSplitView, NSTableView, Menüs, Responder Chain und Drag-and-drop. SwiftUI für Einstellungen, Verbindungsformulare und einfache Detailansichten. Begründung: Die dicht bedienbaren Dateitabellen und Finder-Interaktion sind die Kernoberfläche.

**SSH-Basis:** libssh2 hinter einer kleinen eigenen Swift-Schnittstelle als bevorzugter Kandidat. Die Bibliothek bietet SFTP, SCP und SSH-Exec sowie mehrere Authentifizierungsmethoden. Konkrete Version, Kryptografie-Backend, Lizenzhinweise, Schlüsselkompatibilität und Build-Reproduzierbarkeit werden im ersten Meilenstein geprüft. Die Auswahl ist bis zu diesem Nachweis vorläufig. [libssh2: Fähigkeiten](https://libssh2.org/)

OpenSSH-Unterprozesse bleiben eine Vergleichsoption im Prototyp. Sie erleichtern bestimmte SSH-Konfigurationen, erschweren aber strukturierte Fortschrittsmeldungen, Passwortdialoge und Prozesssteuerung. Keine interaktive Terminalausgabe als dauerhaftes UI-Datenmodell verwenden.

```text
AppKit-/SwiftUI-Oberfläche
          ↓
SessionStore · BrowserModel · TransferQueue
          ↓
LocalFileService | RemoteFileService mit Fähigkeitenmodell
                         ↓
               SFTPBackend | SCPBackend + SSHExec
                         ↓
                    SSH-Transport

Querschnitt: KeychainStore · HostKeyStore · ProfileStore · Diagnose
```

Netzwerk und Dateiarbeit laufen außerhalb des Main Threads. Ein SSH-Sitzungshandle wird seriell verwaltet; parallele Transfers erhalten getrennt verwaltete Sitzungen. Cancellation, Timeouts und Wiederverbindung sind explizite Zustände. Die Oberfläche fragt Fähigkeiten wie `canResume` und `canSetPermissions` ab, statt Protokollnamen überall auszuwerten.

Profile als versionierbare Codable-Daten im Application-Support-Verzeichnis, Einstellungen über UserDefaults. Keine Zugangsdaten in Protokollen. Remote-Pfade als eigene Datenart behandeln, damit lokale Pfadnormalisierung oder URL-Decodierung ihre Bedeutung nicht verändert.

Vertriebsvorschlag: zuerst signierte und notarisierte Direktdistribution. Eine Mac-App-Store-Version separat nach Prüfung von Sandbox, Ordnerzugriff und SSH-Agent-Anbindung planen. Lokale Zugriffsfehler müssen verständlich angezeigt werden; Vollzugriff auf alle Dateien ist keine Voraussetzung des Produkts.

## 7. Meilensteine und Aufwand

Schätzung für eine erfahrene Vollzeitkraft, ohne vorhandene Codebasis. Personenarbeitstage, keine feste Terminzusage. Die größten Unsicherheiten sind SCP-Serverkompatibilität, SSH-Schlüsselvarianten und Finder-Drag-and-drop.

| Phase | Ergebnis und Abnahmekriterium | Aufwand |
| --- | --- | --- |
| 1. Technische Risiken prüfen | SFTP und echtes SCP in beide Richtungen; Passwort/Key/Agent; Host-Key-Prüfung; Shell-Auflistung; reproduzierbarer macOS-Build | 4–6 Tage |
| 2. Native Oberfläche | Zwei Dateibereiche, lokale Navigation, Mock-Remote, Fokus, Menüs, Größenänderung und Verbindungsdialog bedienbar | 4–6 Tage |
| 3. Verbindungen und Browser | Profile/Keychain, SFTP-Browsing und Dateioperationen; SCP-Shell-Browsing auf definierten Testservern | 5–8 Tage |
| 4. Transfer-Engine | Rekursive Transfers, Queue, Konflikte, temporäre Dateien, Abbruch, Retry und SFTP-Resume funktionieren | 7–10 Tage |
| 5. Mac-Integration | Finder-Drag-and-drop, Sitzungstabs, VoiceOver, Dark Mode, Tastaturprofil und Einstellungen | 4–6 Tage |
| 6. Stabilisierung und Auslieferung | Integrations- und UI-Abnahme, signierte/notarisierte App, Installations- und Nutzungshinweise | 5–8 Tage |

Summe: 29–44 Arbeitstage; mit 20 % Reserve etwa 7–11 Arbeitswochen. Nach Phase 1 Aufwand und Servermatrix neu bewerten. Ein erster benutzbarer SFTP-Durchstich wird vor vollständiger SCP- und Release-Härtung geliefert.

## 8. Qualität und Definition of Done

- Isolierte Integrationstestserver: OpenSSH mit SFTP, SFTP-only ohne Shell, SCP-Server mit deaktiviertem SFTP sowie die vereinbarte Linux-Shell-Umgebung.
- Authentifizierung: Passwort, verschlüsselter Schlüssel, Agent, Keyboard-Interactive, falsche Zugangsdaten und Host-Key-Wechsel.
- Datei-Testbestand: leere Dateien, große Dateien über 4 GB, viele kleine Dateien, Unicode, Leerzeichen, führende Bindestriche, Shell-Sonderzeichen, Symlinks, schreibgeschützte Ziele und case-sensitive Namenskollisionen auf dem Mac.
- Upload und Download mit Hashvergleich der Testdateien prüfen; echter SCP-Test muss auch bei deaktiviertem SFTP bestehen.
- Netzunterbrechung, Timeout, voller Datenträger, Ruhezustand und Abbruch dürfen keine unvollständige Datei als erfolgreich markieren oder eine vorhandene Zieldatei vorzeitig zerstören.
- Rekursive Löschung mit Symlink-Prüfung; keine Verfolgung von Links außerhalb des beabsichtigten Verzeichnisses.
- Queuezustände und Konfliktentscheidungen als Unit-Tests; reale SSH-Transfers als Integrationstests; kritische Bedienpfade als UI-Tests.
- Manuelle Abnahme mit Tastatur und VoiceOver, Hell-/Dunkelmodus, zwei gleichzeitigen Verbindungen und großen Verzeichnislisten. Zielwert: 10.000 Einträge bleiben nach Laden flüssig scrollbar.
- Protokollfehler nennen Host, Operation und betroffenen Pfad, aber keine Geheimnisse. Löschen und Überschreiben zeigen vorab den konkreten Umfang.
- Die fertige App lässt sich auf einem sauberen Mac der unterstützten Version installieren und ohne separat installierte SSH-Bibliotheken verwenden.

Der nächste Umsetzungsschritt ist Phase 1: ein kleiner nativer Technik-Prototyp mit beiden echten Übertragungswegen und geprüfter SCP-Verzeichnisnavigation. Diese Ergebnisse tragen die anschließende Oberflächen- und Produktentwicklung.
