# Verbindlicher Ablauf für neue VSIX-Pakete

Vom Benutzer am 07.11.2026 festgelegt. Gilt auch für korrigierte Pakete und
Neubauten ohne Versionsänderung. Die dauerhafte Agentenanweisung steht in
[AGENTS.md](../AGENTS.md).

## 1. Änderungsumfang prüfen

Vor dem Bauen den Git-Status, die betroffenen Dateien und den Stand des letzten
geprüften Pakets betrachten. Festhalten, ob Layout/Bedienoberfläche, Version,
Publisher oder Installationsverhalten geändert wurden. Offene Änderungen anderer
Arbeiten nicht durch pauschales Staging oder Aufräumen übernehmen.

## 2. Screenshots bei Änderungen der Oberfläche aktualisieren

- GitHub-README: `README.md` und die dort referenzierten Bilder unter `media/`.
- Website: `sites/filetandem/dist/index.html`, `dist/en/index.html` und
  `dist/assets/screenshots/` im separaten Website-Repository.
- Echte Aufnahmen der betreffenden gebauten Oberfläche mit Beispieldaten verwenden.
  Keine echten Servernamen, Zugangsdaten oder privaten Dateiinhalte zeigen.
- Beschreibung, Alternativtext, Auflösung und Versionsbezeichnung müssen zum Bild
  passen. Neue Dateinamen verwenden, wenn sonst alte Bilder aus Caches erscheinen.
- Desktop- und Mobilansicht prüfen, soweit die Vorschau verfügbar ist. Eine nicht
  mögliche visuelle Prüfung ausdrücklich dokumentieren; sie nicht als bestanden
  bezeichnen. Passende bestehende Aufnahmen dürfen bei unveränderter Oberfläche
  weiterverwendet werden.

## 3. Versionsangaben prüfen

Bei Versionswechseln nach der bisherigen Versionsnummer suchen und jeden Treffer
einordnen. Typische Stellen sind:

| Bereich | Zu prüfen |
| --- | --- |
| Paket | `package.json`, Wurzelversion und Paketwurzel in `package-lock.json` |
| Änderungen | `CHANGELOG.md`, README und aktuelle Produkt-/Release-Dokumentation |
| Website | DE/EN, Downloadbuttons, VSIX-Dateinamen, Release-URLs, Projektangaben, gegebenenfalls Metadaten |
| Medien | Screenshot-Beschriftungen und tatsächlich gezeigte Version; Angaben zu bestehenden Videoaufnahmen prüfen |
| Auslieferung | VSIX-Dateiname, eingebettetes Manifest, VSIX-Identität, SHA-256-Datei und Build-Nachweis |
| Veröffentlichungen | Bei gesondert beauftragtem Release: Tag, Releasebeschreibung und passende Assets |

Historische Changelog-Einträge, frühere Release-Nachweise, Abhängigkeitsversionen
und die VS-Code-Mindestversion bleiben korrekt historisch beziehungsweise
technisch begründet. Eine ältere Videoaufnahme darf nicht einfach als Aufnahme
der neuen Version ausgegeben werden. Publisherwechsel zusätzlich nach
[publisherwechsel.md](publisherwechsel.md) behandeln.

## 4. Prüfen und bauen

Die Node-Version aus `.nvmrc` verwenden. Regulär `npm run quality`,
`npm run package` und `npm run test:installed` in einem isolierten VS-Code-Profil
ausführen. Nach Änderung an Quelltext, Build-Eingaben oder Paketmetadaten die
betroffenen Prüfungen und den Paketbau erneuern; unveränderte, bereits bestandene
Prüfungen müssen nicht ohne Grund wiederholt werden. Bei weiterreichenden
Änderungen die passenden Integrations- und Release-Tests ergänzen.

`scripts/inspect-vsix.py` kontrolliert unter anderem die Übereinstimmung von
Publisher, Paketname und Version zwischen Quellmanifest, Paketmanifest und
`extension.vsixmanifest`. SHA-256 des ausgelieferten Pakets festhalten.
Das Marketplace-Icon wird als PNG aus dem fertigen Paket geprüft und darf
höchstens 1024 × 1024 Pixel groß sein. Ein eigenes verkleinertes Paket-Icon
verwenden, wenn das hochauflösende Logo für Website und README größer ist.

## 5. Bei jedem Build committen und pushen

Alle zugehörigen Quelltext-, Dokumentations-, Test- und Screenshot-Änderungen
gezielt stagen, prüfen, committen und auf den vorgesehenen Remote-Branch pushen.
Die Commitnachricht beschreibt die tatsächliche Änderung und gegebenenfalls die
Version. Vor dem Push konkurrierende Remote-Änderungen berücksichtigen; kein
Force-Push. Den erfolgreichen Push und die Remote-Commit-ID prüfen.

Die VSIX selbst bleibt als generiertes Artefakt unter `out/` und wird nicht in die
Git-Historie aufgenommen. Ein beauftragtes Release kann sie separat als Asset
bereitstellen. Die Commit-ID des gebauten Quellstands im lokalen Build-Nachweis
festhalten; Nachweise unter `out/` dürfen nach dem Commit ergänzt werden.

Die Website besitzt ein eigenes Repository. Änderungen dort separat committen;
Push nur zum dafür vorgesehenen Remote. Ist keines eingerichtet, diesen Umstand
ausdrücklich melden und die Website lokal erhalten. Kein Remote erfinden und
keine Veröffentlichung aus einem Commit-/Push-Auftrag ableiten.

Ist der Quellstand bereits vollständig committed und gepusht, ist kein leerer
Commit nötig: den vorhandenen Commit und seine Übereinstimmung mit dem Remote
bestätigen. Fehlgeschlagene Prüfungen oder Pushes als offen melden; ein gebautes
Paket ist dann nicht als vollständig abgeschlossener Release auszugeben.
