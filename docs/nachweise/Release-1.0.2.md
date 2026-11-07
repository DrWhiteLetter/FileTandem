# Release 1.0.2

Stand: 07.11.2026. Korrektur der Marketplace-Beschreibung für `RootShellForge.xscp`.

## Änderungen

- VSIX-Bau und isolierter Pakettest lassen `vsce` relative Bild- und Dokumentationslinks anhand des öffentlichen GitHub-Branches `main` in HTTPS-Adressen umwandeln.
- Die unabhängige ZIP-Prüfung verlangt absolute HTTPS-Bildlinks in der README. Die vorherige VSIX 1.0.1 wird wegen ihrer relativen Bildlinks erwartungsgemäß abgewiesen.
- README und aktuelle Installationsanleitung verweisen auf den Marketplace. GitHub-Releases bleiben als alternative, gegebenenfalls ältere VSIX-Quelle verlinkt.
- Version in Manifest und Lockfile: 1.0.2. Publisher und Paketname bleiben unverändert. Keine Änderung an Erweiterungsoberfläche oder Laufzeitverhalten. Screenshots und Video zeigen weiterhin ausdrücklich 1.0.1; historische Nachweise bleiben erhalten.
- Website DE/EN lokal auf Marketplace-Installation und Version 1.0.2 vorbereitet. Kein Deployment. Das separate Repository hat keinen Remote; daher ist dort kein Push möglich. Bestehende Bilddateien und Beschriftungen bleiben korrekt auf 1.0.1.

## Prüfungen

- Node 22.13.1; `npm run quality`: 148 Unit- und 12 Webview-Tests bestanden, außerdem Lokalisierungsprüfung, Lint, statische Prüfung und Build.
- `npm run package` und unabhängige ZIP-Prüfung erfolgreich: Identität in Quellmanifest, Paketmanifest und VSIX-Metadaten identisch; PNG-Icon 512 × 512; keine Fixture-Geheimnisse oder Entwicklungsdateien.
- Beide umgeschriebenen README-Bildadressen liefern öffentlich HTTP 200 und PNG-Inhalt.
- `npm run test:installed`: isolierte Installation und echter Commander-Webview-Handshake unter VS Code 1.145.0 auf macOS ARM64 erfolgreich. Ein erster Aufruf mit dem falschen ausführbaren Dateinamen `Electron` wurde auf `Code` korrigiert.
- Website DE/EN: lokale Seiten- und Medienverweise geprüft. Keine erneute visuelle Desktop-/Mobilabnahme der lediglich textlich geänderten Website.
- Keine neuen Windows-/Linux-Tests; frühere Plattformnachweise sind historisch.

## Auslieferung

Paket: `out/FileTandem-1.0.2.vsix`; Prüfsumme in der gleichnamigen `.sha256`-Datei. Commit, bestätigter Push, SHA-256 und Marketplace-Uploadstatus werden nach Abschluss in `out/vsix-build-report.json` festgehalten. Ein erfolgreicher lokaler Build allein belegt keine Veröffentlichung.
