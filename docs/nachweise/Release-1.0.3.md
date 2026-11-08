# Release 1.0.3

Stand: 08.11.2026. Neue Erweiterungsidentität `RootShellForge.filetandem`.

## Änderungen

- Paketname `filetandem`, Publisher unverändert `RootShellForge`, Version 1.0.3.
- Manifest, Lockfile, aktuelle Dokumentation und Website DE/EN angepasst.
- Testskripte und Fixtures verwenden FileTandem-Kennungen; Testvariablen beginnen mit `FILETANDEM_`.
- Neue Teil-Dateien verwenden `.filetandem-`; alte `.xscp-`-Teil-Dateien bleiben ausgeschlossen. Alte Speicher- und Befehlskennungen bleiben als Kompatibilität erhalten.
- Bestehende Erweiterungsidentitäten teilen keine Profile, Secrets oder Journale. Siehe [Identitätswechsel](../identitaetswechsel-filetandem.md).
- Oberfläche unverändert. Bestehende Screenshots und Video bleiben ausdrücklich Aufnahmen von 1.0.1.

## Prüfung und Veröffentlichung

Der maschinenlesbare lokale Nachweis `out/vsix-build-report-1.0.3.json` hält
Prüfergebnisse, Paket-SHA-256, Commit, Push und Marketplace-Status getrennt fest.
Ein Paketbau ist kein Nachweis einer abgeschlossenen Marketplace-Validierung.
Paket: `out/FileTandem-1.0.3.vsix`, Prüfsumme: gleichnamige `.sha256`-Datei.

Website-Änderungen werden im separaten Repository lokal committed. Dort ist kein
Remote eingerichtet, daher kein Push möglich. Kein Website-Deployment.
Keine neuen Windows-/Linux-Nachweise und keine erneute visuelle Website-Abnahme.
