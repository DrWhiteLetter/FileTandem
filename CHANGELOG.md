# Changelog

## 1.0.2 – 07.11.2026

- Bild- und Dokumentationslinks beim VSIX-Bau für den Marketplace in absolute HTTPS-Adressen umwandeln.
- Paketprüfung weist relative README-Bildverweise zurück.
- Installationsanleitung auf den veröffentlichten Marketplace-Eintrag umstellen; Oberfläche und Laufzeitverhalten bleiben unverändert.

## 1.0.1 – 06.11.2026

- Optionale, standardmäßig deaktivierte Eigentümerprüfung bei Uploads: Eigentümer-/Gruppenwechsel vor dem Ersetzen erkennen und betroffene Datei stoppen. Bestehende Metadatenabfragen für SFTP/SCP wiederverwenden.
- Doppelten Abbrechen-Button im Transfer-Konfliktdialog durch explizite native Abbruchaktion vermeiden. „Alle weiteren ersetzen“ auf „Alle ersetzen“ kürzen; englisch „Replace all“.

- README mit aktueller Commander-Ansicht, Transferfortschritt und Aktionen zum Aufräumen des Verlaufs bebildern.

## 1.0.0 – 06.11.2026

- Beim unmittelbaren Reload den aktuellen Transferstand speichern, auch wenn eine gebündelte Änderungsbenachrichtigung noch aussteht.
- Erste finale Veröffentlichung als VSIX über das öffentliche GitHub-Repository.
- Plattformnachweise für macOS Apple Silicon, Windows und Debian 13.7 mit Xfce auf ARM64 dokumentieren; Linux-Test mit VS Code 1.145.0 vom Projektinhaber bestätigt.
- README, Installationsanleitung, Support- und Release-Angaben aktualisieren. Bestehende Extension-ID und gespeicherte Profile bleiben kompatibel.
- Sicherheitsbefund in der Entwicklungsabhängigkeit minimatch durch Override auf 11.0.1 beheben; kein Wechsel der Laufzeitabhängigkeiten.
- Release-Runner prüft die tatsächlichen VS-Code-Installationsversionen; der installierte Editor-Test berücksichtigt die aktive Oberflächensprache.

## 0.0.28 – 05.11.2026

- Erfolgreiche Transfers direkt aus dem Verlauf entfernen oder alle beendeten Einträge nach Bestätigung ausblenden; laufende und wartende Aufträge sowie Dateien bleiben erhalten. Die Auswahl gilt pro Profil in allen Sitzungen und bleibt nach Neustart bestehen.

## 0.0.27 – 05.11.2026

- Hochladen und Herunterladen als größere Hauptaktionen in einer eigenen Zeile hervorheben.
- Ordner durch gefüllte, farbige Symbole deutlicher von Dokumenten unterscheiden.
- Fortschrittsbalken nach bearbeiteten Einträgen, Datenmenge und Geschwindigkeit auch bei eingeklappter Transferliste anzeigen; Ergebnisse getrennt ausweisen.

## 0.0.26 – 04.11.2026

- Beim manuellen Remote-Löschen zusätzlich „Ohne Sicherung löschen“ anbieten, auch wenn .bak-Sicherungen aktiviert sind.

- Bereits gelesene Dateimetadaten beim Befüllen der Warteschlange wiederverwenden; Ordner weiterhin vor dem Betreten prüfen. Queue-Planung auf wartende Aufträge begrenzen und zusammenfassen.
- SFTP-Blöcke innerhalb einer Datei mit bis zu acht ausstehenden Anfragen übertragen und geordnet prüfen; verkürzte Antworten, Abbruch und Fehler berücksichtigen. Kleine SSH-Pakete ohne zusätzliche TCP-Bündelungsverzögerung senden.
- Fortschrittsmeldungen als kompakte Queue-Aktualisierungen senden, statt sämtliche Verzeichnislisten und die ganze Historie zu übertragen. Summen und Wiederholungsaktionen bleiben vollständig.
- Verzeichnislisten nach Transfers nur für tatsächlich betroffene Zielbereiche erneut laden.
- Schnellen Modus als Standard für manuelle SFTP-Uploads verwenden: SSH-Transport, Quellenkonsistenz und Größe prüfen, ohne den Serverinhalt vollständig zurückzulesen. Zusätzliche SHA-256-Abschlussprüfung unter „Sicherheitsfeatures“ optional aktivieren; Fortsetzung, Überwachung und geprüfte Editor-Uploads verwenden sie weiterhin.

## 0.0.25 – 03.11.2026

- SFTP-Sammelübertragungen mit bis zu vier parallelen Aufträgen ausführen; verifizierte SFTP-Kanäle exklusiv wiederverwenden und nach Fehler, Abbruch oder Leerlauf schließen.
- Metadaten und Dateiinhalt über denselben Transferkanal übertragen; Rechte und Zeitstempel mit einer gemeinsamen Anfrage setzen.
- Aktualisierungen von Transferjournal und Oberfläche bündeln, damit große Warteschlangen den Upload nicht durch wiederholte Verarbeitung der gesamten Historie ausbremsen.
- SHA-256-Prüfung, Konfliktentscheidungen, sichere Veröffentlichung und explizite Wiederaufnahme beibehalten.

## 0.0.24 – 02.11.2026

- Lokale Bilder direkt und entfernte Bilder als temporäre, schreibgeschützte Vorschau öffnen; Ladefortschritt für entfernte Bilder und Dateien anzeigen und doppelte Öffnungsversuche bündeln.
- Lokalen Dateimanager mit zwei unabhängig navigierbaren lokalen Spalten öffnen. Dateien und Ordner in beide Richtungen über Kopieraktionen, Kontextmenü, Drag-and-drop und F5 übertragen.
- Lokale Kopien über die Transferwarteschlange mit Fortschritt, Abbruch, Konfliktentscheidungen und geprüfter Veröffentlichung ausführen; Selbstkopien und Kopien in eigene Unterordner verhindern.
- Dateiaktionen in beiden lokalen Spalten anbieten und lokale Kopien ohne SSH-Profil im Transferjournal speichern.

## 0.0.23 – 01.11.2026

- Konfliktentscheidungen paralleler Dateien desselben Sammelauftrags koordinieren: „Alle weiteren ersetzen“ verhindert zusätzliche, bereits parallel angeforderte Ersetzen-Dialoge. Einzelentscheidungen, Abbruch und der Schutz vor unsicheren Ersetzungen bleiben erhalten.

## 0.0.22 – 31.10.2026

- Windows-Qualitätsprüfung korrigiert: einheitliche Zeilenumbrüche, toleranter Übersetzungscheck sowie plattformgerechte SSH-Agent- und Spiegelungstests; Regressionstest für CRLF ergänzt.
- Einstellungs-Zahnrad ganz rechts in der oberen Aktionsleiste platziert.
- Aktuelles Installationspaket einschließlich Ausschlussregeln, optionaler `.bak`-Löschsicherungen und Wiederherstellung bereitgestellt.

## 0.0.21 – 30.10.2026
- Ausschlussregeln für Dateiendungen, Namensmuster und versteckte Dateien in den VS-Code-Einstellungen ergänzen; ausgeschlossene Einträge im Dateimanager kennzeichnen und bei Transfers, Ordnerabgleich und Überwachung schützen.
- Remote-Löschungen standardmäßig durch Umbenennen in `.bak` sichern; vorhandene Sicherungen nummerieren, automatisch ausschließen und ohne Überschreiben wiederherstellen. Lokale Löschungen verwenden weiterhin den Papierkorb.
- Einstellungen direkt über das Zahnrad öffnen; Änderungen beenden eine laufende Überwachung. Deutsche und englische Texte sowie Hinweise zu öffentlich erreichbaren Sicherungsdateien ergänzen.
- Regeln, Namenskollisionen, Wiederherstellung und geänderte Einstellungen mit Diensttests, gerenderter Oberfläche und echten SFTP-/SCP-Verbindungen prüfen.

## 0.0.20 – 30.10.2026
- Deutsch und Englisch durchgängig über zentrale Sprachressourcen anbieten; native Dialoge verwenden die VS-Code-l10n-API und englische Ausgangstexte. Die Editorsprache wird standardmäßig übernommen, nicht unterstützte Sprachen verwenden Englisch.
- Fehlende Übersetzungen für Ordnerabgleich, SSH-/Transferfehler und Überwachungsstatus ergänzen; Dateisortierung verwendet die gewählte Sprache.
- Sprachkataloge, Platzhalter, Dialogentscheidungen und deutsche/englische Oberflächen automatisch prüfen; Sprachbundles in die VSIX aufnehmen.

## 0.0.19 – 29.10.2026
- Bei geändertem SSH-Host-Key zusätzlich „Ohne Prüfung vertrauen und verbinden“ anbieten. Der Dialog erklärt das Risiko; die Bestätigung durch exakte Fingerprint-Eingabe bleibt verfügbar.

## 0.0.18 – 29.10.2026
- Geänderte SSH-Host-Keys nach Serverumzug im nativen Dialog prüfen: bisherigen und neuen Fingerprint anzeigen, unabhängigen Abgleich verlangen und Ersatz erst nach exakter Eingabe des neuen SHA256-Fingerprints speichern. Abbruch und nicht bestätigte Schlüssel bleiben blockiert.

## 0.0.17 – 28.10.2026
- Dateiliste bleibt bei Aktualisierungen stabil: vorhandene Zeilen, Auswahl und Scrollposition bleiben erhalten; Ladeanzeige nach 300 ms als Spinner in der Kopfzeile. Ladehinweis im Listenbereich nur beim erstmaligen Laden ohne vorhandene Einträge.
- Aktualisierungen nach Transfers in 250-ms-Fenstern bündeln; laufende Verzeichnisabfragen nicht überlappen und ausstehende Aktualisierungen beim Schließen verwerfen.
- Separaten Website-Checkout aus dem Erweiterungspaket ausschließen.

## 0.0.16 – 28.10.2026
- Commander gezielt verfeinert: klare Aktionsgruppen, ruhige Dateiwerkzeuge, konsistente Abstände, kompakte Pfadnavigation und strukturierter Überwachungsstatus mit einer Stopp-Aktion.
- Transferhistorie zeigt neueste Aufträge zuerst, vollständige Zielpfade als Tooltip, getrennte Status-/Aktionsbereiche und einen Hinweis auf fehlgeschlagene Aufträge. Der eingeklappte Zustand bleibt erhalten; bereits veröffentlichte Dateien bieten keine unnötige Teil-Datei-Bereinigung mehr an.
- Filter lassen sich direkt zurücksetzen; Leer-, Lade-, Verbindungs- und Fehlerzustände bieten passende nächste Schritte. Fehler zeigen keine veraltete Dateiliste als aktuellen Inhalt.
- Native Theme-Tokens, helle/dunkle Formulare, sichtbare Tastaturfokusse, bedienbare Kontextmenüs und Umbruch in schmalen Ansichten verbessert. Keine neuen Abhängigkeiten.
- Isolierte VS-Code-Vorschau mit synthetischen Daten für Theme-/Layoutkontrollen ergänzt; Bedienung und Abnahme siehe `docs/ui-feinschliff.md`.

## 0.0.15 – 27.10.2026
- Start der Überwachung spiegelt den lokalen Ordner auf die Gegenstelle: fehlende/abweichende Dateien übertragen, überzählige Remote-Einträge löschen, leere Ordner und Typkonflikte abgleichen.
- Lokale Löschungen einschließlich Unterordnern übernehmen; Remote-Ansicht automatisch aktualisieren und gelöschte Einträge im Status zählen.
- Prüfsummen bereits beim Start erfassen, fremde Änderungen vor Löschungen schützen und Queue-Pause auch für Löschungen beachten.
- Docker-unabhängige Diensttests mit echten lokalen Dateibäumen für Startabgleich, Dateilöschungen, Typkonflikte und Stopp ergänzen.

## 0.0.14 – 26.10.2026

- „Remote-Ordner aktuell halten …“ ergänzt: gespeicherte lokale Dateiänderungen rekursiv erkennen und automatisch hochladen, auch aus externen Programmen. Sichtbarer Status mit Stoppen, feste Ordnerzuordnung und Sperre manueller Transfers für dasselbe Profil.
- Mehrere Speichervorgänge bündeln, Serverkonflikte erkennen und bei Fehlern oder Verbindungswechsel stoppen. Lokale Dateilöschungen werden nach zwei Beobachtungen remote übernommen; geänderte Remote-Dateien bleiben erhalten. Kein automatischer Neustart nach Sitzungsende.
- Manueller Ordnerabgleich bleibt als Erstabgleich und für einzelne Abgleiche erhalten.

## 0.0.13 – 26.10.2026

- Überschreibkonflikte in einem einzigen modalen Dialog entscheiden: „Ersetzen“ startet direkt für diese Datei, „Alle weiteren ersetzen“ gilt zusätzlich für weitere Dateikonflikte desselben Sammelauftrags. Die leicht übersehbare zweite Auswahl entfällt.

## 0.0.12 – 26.10.2026

- Pfadfavoriten und manueller rekursiver Ordnerabgleich mit Vorschau und Transferauswahl ergänzt.

## 0.0.11 – 08.10.2026

- F5 über einen eigenen, auf FileTandem begrenzten VS-Code-Befehl verarbeitet; Auswahl wird auch nach Fokuswechsel auf Buttons übertragen. Kein zusätzlicher Debuggerstart.
- Nativer Regressionstest mit echten Tastaturereignissen, SFTP-Testupload und Debug-Startmarker; normales F5-Debuggen außerhalb FileTandem bleibt erhalten.

## 0.0.10 – 08.10.2026

- F5/F3–F8 in der Dateiliste werden bei aktivierten Commander-Tasten vollständig verarbeitet und nicht zusätzlich an VS Codes Tastaturverarbeitung weitergeleitet.
- Modifizierte Funktionstasten und Eingabefelder behalten normale VS-Code-Tastenkürzel.

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
