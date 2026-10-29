# Changelog

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
