# Meilensteine zum Abarbeiten

Dieser Backlog konkretisiert den [Umsetzungsplan](../../UMSETZUNGSPLAN.md). Er beschreibt geplante Arbeit und ihren Fortschritt; M0-01, M0-03 und M0-04 sind umgesetzt und geprüft; die Remote-Abnahme von M0-02 ist noch offen. JavaScript/JSX, SFTP als Standard und echtes SCP bleiben die Grundlage.

**59 einzeln abhakbare Items** mit stabilen IDs, Abhängigkeiten, Umsetzung und Fertig-Kriterium.

## Reihenfolge

| Meilenstein | Ergebnis | Items | Aufwand |
| --- | --- | ---: | --- |
| [M0: Technische Nachweise](M0.md) | Technische Risiken geklärt | 9 | 4–6 Tage |
| [M1: Extension-Grundgerüst](M1.md) | Installierbare Oberfläche mit Mock-Daten | 7 | 3–5 Tage |
| [M2: Verbindungen und Dateibrowser](M2.md) | Reale Verbindungen und Dateiverwaltung | 9 | 4–6 Tage |
| [M3: Transfer-Engine und SFTP-Alpha](M3.md) | Benutzbare SFTP-Alpha | 9 | 6–9 Tage |
| [M4: SCP und sicherer Wiederanlauf](M4.md) | SCP und geprüfter Wiederanlauf | 8 | 5–8 Tage |
| [M5: Editorintegration und Bedienung](M5.md) | Remote-Bearbeitung und vollständige Bedienung | 8 | 4–6 Tage |
| [M6: Release-Härtung und Auslieferung](M6.md) | Geprüfte VSIX; optionale Veröffentlichung | 9 | 5–8 Tage |

Empfohlen: **M0 → M1 → M2 → M3 → M4 → M5 → M6**. Einzelne M5-Aufgaben können nach M3 beginnen; ihre vollständige Abnahme benötigt auch SCP aus M4. Bereits im Prototyp implementierte Teile werden später übernommen und gehärtet, nicht doppelt gebaut.

## So arbeitest du die Liste ab

1. Öffne M0 und beginne mit **M0-01**. Wähle anschließend ein Item, dessen Abhängigkeiten erledigt sind.
2. Implementiere nur den beschriebenen Umfang. Ein Item ist eine Arbeitseinheit, nicht zwingend ein einzelner Commit oder eine feste Zahl von Stunden. Größere Items bei Bedarf in Unteraufgaben aufteilen und die ID beibehalten.
3. Prüfe das Fertig-Kriterium. Protokolliere Ergebnisse kurz unter `docs/nachweise/`; relevante Tests gehören zur jeweiligen Änderung und werden nicht auf M6 verschoben.
4. Setze `[x]` erst nach erfolgreicher Prüfung. Ein dokumentierter Fehler allein erfüllt kein Erfolgskriterium.
5. Committe einen nachvollziehbaren Stand, beispielsweise `feat(M2-05): add SFTP directory browser`. Notiere die Item-ID in Commit oder PR.
6. Schließe einen Meilenstein erst nach seinen erforderlichen Aufgaben und dem Abschlussnachweis ab.

Du kannst später beispielsweise sagen: **„Setze M0-01 um“** oder **„Prüfe, ob M3-03 fertig ist“**.

## Umfang und externe Voraussetzungen

- Gesamtaufwand bleibt zunächst 31–48 Arbeitstage, mit Reserve ungefähr 8–12 Arbeitswochen. Nach M0 neu bewerten; für Einarbeitung zusätzlich Zeit einplanen.
- Docker/Container oder isolierte VMs werden für Protokolltests benötigt; Testserver können alternativ auf einem separaten Rechner laufen.
- Remote-SSH-/Container-Umgebungen und passende Testsysteme für Windows/Linux/macOS müssen verfügbar sein. Fehlen sie, bleiben die entsprechenden Abnahmen offen.
- Ein gehosteter CI-Lauf benötigt später ein Remote-Repository. Die lokale Entwicklung und VSIX-Erstellung funktionieren vorher.
- Produktname, Publisher und eigene Lizenz werden vor öffentlicher Veröffentlichung geklärt. M6-09 benötigt einen ausdrücklichen Veröffentlichungsauftrag.
- Kein Item autorisiert Tests gegen produktive Server oder reale Benutzerdaten. Fixtures sind isoliert und reproduzierbar.
- Zusatzfunktionen wie Synchronisierung, Terminal und Browser-Version bleiben außerhalb dieses Backlogs.
