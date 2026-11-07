# Verbindliche Regeln für FileTandem

## VSIX bauen und abschließen

Bei jedem Auftrag, eine neue oder korrigierte VSIX zu bauen, gilt der Ablauf in
[docs/vsix-releaseprozess.md](docs/vsix-releaseprozess.md). Ein erfolgreicher
Paketbau allein schließt den Auftrag nicht ab.

1. Änderungen gegenüber dem letzten geprüften Paket auf Auswirkungen auf
   Oberfläche, Version, Publisher und Dokumentation prüfen.
2. **Oberfläche geändert:** passende aktuelle Screenshots für die GitHub-README
   und die Website aktualisieren. Die Website liegt als separates Repository
   unter `sites/filetandem`; deutsche und englische Seite berücksichtigen.
   Bildunterschriften, Alternativtexte, Bildabmessungen und Versionsbeschriftungen
   an die tatsächlichen Aufnahmen anpassen. Alte Bilder nicht nur neu beschriften.
3. **Version geändert:** alle aktuellen Versionsangaben und Downloadverweise
   durchsuchen und prüfen; insbesondere Manifest, Lockfile, Changelog, README,
   aktuelle Release-Dokumentation, Website DE/EN sowie versionierte Artefakte.
   Historische Nachweise und die VS-Code-Mindestversion nicht pauschal ersetzen.
4. Relevante Qualitätsprüfungen, Paketprüfung und eine isolierte Installation
   durchführen. Publisher, Name und Version in Paketmanifest und VSIX-Metadaten
   müssen übereinstimmen. Keine echten Zugangsdaten oder Nutzerprofile für Tests.
5. **Bei jedem lokalen VSIX-Build immer committen und pushen.** Alle zum Build
   gehörenden Änderungen einschließlich Dokumentation, Tests und Screenshots
   vor der Abschlussmeldung in den zuständigen Repositorys committen und auf
   den vorgesehenen Remote-Branch pushen. Auch bei unveränderter Versionsnummer
   gilt diese Regel. Fremde Änderungen nicht ungeprüft aufnehmen.
6. Commit-SHA, erfolgreichen Push, Paketpfad, Version und Prüfungsergebnis
   nachvollziehbar festhalten. Bei fehlendem Remote, fehlgeschlagenem Push oder
   ausstehender Prüfung die verbleibende Arbeit ausdrücklich melden; weder
   einen Erfolg behaupten noch eigenmächtig ein Remote anlegen oder force-pushen.

Die Commit-/Push-Regel betrifft den vom Agenten betreuten lokalen Build-Abschluss.
Die schreibgeschützten CI-Prüfjobs erzeugen keine automatischen Commits und Pushes.
Das ist keine pauschale Erlaubnis, Marketplace-Releases zu veröffentlichen,
GitHub-Release-Assets auszutauschen oder die Website zu deployen. Die bestehende
Vorgabe, Website-Änderungen nur lokal vorzubereiten, bleibt bis zu einer anderen
Benutzeranweisung bestehen.

## Arbeitsverzeichnis schützen

- `.env`, Schlüssel, Testzugangsdaten, lokale VS-Code-Einstellungen und generierte
  Testprofile nicht committen oder in die VSIX aufnehmen.
- Das Website-Repository nicht versehentlich als eingebettetes Repository zum
  Erweiterungs-Repository hinzufügen. Vor separatem Push dessen Remote prüfen.
- Keine unbelegten Aussagen über getestete Plattformen oder Veröffentlichungen.
