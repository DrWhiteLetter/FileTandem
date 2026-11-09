# Marketplace-Vorbereitung, 09.11.2026

Status: nur lokal vorbereitet. Kein VSIX-Build, kein Commit/Push, keine Veröffentlichung, keine versendeten Einladungen und kein Website-Deployment. Version und Identität bleiben 1.0.3 / RootShellForge.filetandem. Die heutigen Benutzertests können vor dem nächsten Release einfließen.

## Vorbereitet

- Englische README mit Nutzen, Demo, Ersttransfer-Anleitung und ehrlicher Bewertungsbitte nach tatsächlicher Nutzung.
- Vollständige deutsche Anleitung in README.de.md erhalten. Identitätswechsel in beiden Sprachen in einen späteren Abschnitt verschoben.
- Englische/deutsche Kurzbeschreibung und relevante Suchbegriffe ergänzt; Kategorie Other beibehalten.
- GitHub-Issue-Formulare für Fehler und Ersttransfer-Feedback; zehnminütiger Testablauf in beiden Sprachen.
- Deutsche/englische Community-Texte, persönliche Einladung, Rückfrage nach Nutzung und Vorgehen zur Bearbeitung von Rückmeldungen.
- Changelog unter Unreleased ergänzt. Marketing-Entwürfe vom VSIX-Inhalt ausgeschlossen.

## Kurzdemo

Quelle: vorhandene, laut sites/filetandem/review/video-integration.md freigegebene v4-Testserver-Aufnahme unter sites/filetandem/dist/assets/video/filetandem-developer-demo.mp4. Keine neue Aufnahme und keine Umkennzeichnung auf 1.0.3.

Schnitt: 52–61 s (verbundene Sitzung), 64–73 s (Upload), 99–108 s (Remote-Editor). 27 Sekunden, 960 × 540, 6 Bilder/s, ohne Ton, keine Endlosschleife. Ausgabe: media/filetandem-quick-tour.gif. Textalternative im Ersttransfer-Leitfaden. Versions- und Schnittangabe stehen bei der Demo. Das lange Website-Video bleibt unverändert.

## Prüfung

- JSON-Metadaten, unveränderte Version/Publisher/Name und Übereinstimmung mit Lockfile geprüft.
- Lokale Markdown-Dateiverweise in README EN/DE und Testleitfaden vorhanden.
- Lokalisierungsprüfung mit Node 22.13.1 bestanden. Standard-Shell verwendet noch Node 14 und kann das Skript nicht ausführen; kein Projektfehler.
- Beide Issue-Formulare mit Ruby YAML eingelesen; Pflichtstruktur und eindeutige Feld-IDs geprüft.
- GIF mit ffprobe geprüft: 27 Sekunden, 960 × 540, 162 Frames. Kontaktbogen der drei Szenen visuell geprüft; Testpfade und Demo-Server, keine echten Zugangsdaten sichtbar.
- git diff --check bestanden. Kein Laufzeitcode geändert; kein vollständiger Laufzeit-/Release-Test durchgeführt.

## Vor der Veröffentlichung

1. Heutige Testergebnisse einarbeiten und Unreleased-Notizen um konkrete Korrekturen ergänzen.
2. Falls sich die Oberfläche ändert, Demo/Screenshots erneut auf Aktualität prüfen und erforderliche Aufnahmen ersetzen.
3. Nächste Version festlegen und den vollständigen VSIX-Releaseprozess ausführen. Erst dann Commit/Push und die gesondert freizugebende Veröffentlichung.
4. README.de.md, GIF und Issue-Formulare müssen auf dem vorgesehenen GitHub-Branch erreichbar sein, bevor die darauf verweisende Marketplace-Fassung veröffentlicht wird. Öffentliche Darstellung und Formularfunktion dann prüfen.
5. Nach Freigabe Einladungen gezielt versenden; bis dahin keine Empfänger kontaktieren.
