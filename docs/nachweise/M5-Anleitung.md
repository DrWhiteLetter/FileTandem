# xScp 0.0.5 ausprobieren

Die private VSIX liegt unter `out/xscp-0.0.5.vsix`. In VS Code Desktop ab 1.140.0: Erweiterungen → „…“ → „Aus VSIX installieren…“, danach Fenster neu laden. Bestehende Profile und Transferhistorie bleiben erhalten.

## Serverdateien bearbeiten

1. Profil verbinden und im Dateimanager eine Datei doppelklicken oder mit Enter öffnen.
2. SFTP öffnet zunächst schreibgeschützt. Über die Statusleiste oder „xScp: Remote-Bearbeitung freigeben“ die konkrete Datei freigeben. Danach schreiben Speichern **und Auto Save** direkt auf den Server.
3. Bei Konflikten bleiben eigene Änderungen ungespeichert. „xScp: Server und Editor vergleichen“ zeigt Serverstand und eigenen Entwurf. Änderungen im ursprünglichen Editor abgleichen; anschließend „xScp: Verglichenen Serverstand als Basis übernehmen“ bewusst bestätigen. Eine inzwischen erneut geänderte Serverfassung wird abgewiesen.
4. „xScp: Remote-Datei sperren“ nimmt die Freigabe zurück. Nach Schließen/Trennen/Neuverbindung erneut öffnen und freigeben. „xScp: Neue Remote-Datei anlegen“ erstellt nach Freigabe eine SFTP-Datei, ohne vorhandene Dateien zu ersetzen.

**SCP:** Öffnen lädt eine lokale Kopie über die Queue. Speichern/Auto Save ändern ausschließlich diese Kopie. Erst „xScp: Lokale SCP-Editorkopie hochladen“ oder die Statusleiste erzeugt einen Upload. Der ursprünglich heruntergeladene Serverinhalt wird vor und nach dem Transfer geprüft. Geänderten Serverstand zuerst erneut herunterladen und mit dem eigenen Entwurf abgleichen. Nicht hochgeladene Kopien bleiben privat auf dem Desktop erhalten; „Gespeicherte Editorkopie öffnen“ findet sie nach Neustart. Eigene Kopien lassen sich ausdrücklich löschen.

## Dateimanager und Einstellungen

„Neue Sitzung“ öffnet einen unabhängigen Tab desselben Profils. Navigation und Auswahl bleiben getrennt; Transfers dieses Profils sind in allen Tabs sichtbar. Tab-Schließen lässt Transfers weiterlaufen. Trennen fragt bei laufenden/wartenden Aufträgen nach und erklärt deren Abbruch.

Interne Auswahl zwischen linker/rechter Liste ziehen: Das hervorgehobene Ziel nennt den vollständigen Kopierordner. Es entsteht ein Queue-Auftrag. Externes OS-Dropping ist nicht unterstützt. Rechte Maustaste oder Shift-F10 öffnet das Kontextmenü; Pfeile/Enter/Escape bedienen es. Enter öffnet Dateien/Ordner, Backspace geht zum Elternordner, Home/End/Pfeile navigieren und Strg/Cmd-A wählt alles. Für Transfers höchstens 1.000 Quellwurzeln je Auftrag auswählen.

- `xscp.commanderKeys`: optional, standardmäßig aus. F3 Öffnen, F4 Bearbeiten mit Freigabe, F5 Kopieren ins gegenüberliegende Verzeichnis, F6 Umbenennen, F7 Ordner, F8 Löschen. Gilt nur bei Fokus auf Dateizeilen; native Bestätigungen bleiben aktiv.
- `xscp.language`: `auto`, `de` oder `en` für Oberfläche/Dialoge. Befehlstitel folgen der VS-Code-Sprache.
- `xscp.editorPollInterval`: aktive SFTP-Datei alle 2–60 Sekunden prüfen, Standard 5. Inaktive Dateien/Verzeichnisse werden nicht überwacht.
- „Spalten“ verändert Sichtbarkeit und Breite; Filter, Favoriten und Bereichsteilung bleiben pro Tab erhalten. 10.000 Einträge werden virtualisiert.

## Grenzen

Editorlimit 10 MiB, höchstens 32 gehaltene Editorressourcen; größere Dateien als Streaming-Download. Diff-Snapshots sind UTF-8-Textansichten, auf 24 Fassungen/64 MiB begrenzt und werden beim Schließen bereinigt. Andere Textkodierungen/Binärdateien für Vergleiche als lokale Dateien mit passenden VS-Code-Werkzeugen behandeln. Maximal 64 behaltene SCP-Kopien; ungesendete Entwürfe bewusst bereinigen. Remote-URIs/Freigaben werden nicht nach Neustart wiederhergestellt.

SFTP ersetzt bestehende Dateien nur mit der atomaren OpenSSH-Rename-Erweiterung. SCP benötigt die dokumentierte GNU/Linux-Shell. Eigene Ziel-Locks schützen gegen parallele xScp-Aufträge; ohne Server-CAS bleibt ein kleines Race zwischen letzter Prüfung und Publish gegenüber fremden Prozessen. Normale Modusbits bleiben erhalten; Eigentümer, ACLs, Xattrs und spezielle Rechte sind nicht zugesichert. Bei Verbindungsabbruch kann ein eigener Part zur späteren Bereinigung bleiben.

Lokal und in einem echten Remote-SSH-Fenster auf macOS geprüft. Windows/Linux-Desktop, vollständige Screenreader-Abnahme, Last-/Fehlerhärtung und Veröffentlichung gehören zu M6.
