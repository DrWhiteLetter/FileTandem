# Technische Umbenennung zu FileTandem

Stand: 08.11.2026. Release 1.0.3; Prüf- und Veröffentlichungsstatus im [Release-Nachweis](nachweise/Release-1.0.3.md).

## Ursache und Ziel

Der sichtbare Titel war bereits FileTandem, aber `package.json` enthielt noch
`name: xscp`. Die Marketplace-Mail zeigt die aus Publisher und Paketname
gebildete ID. Manifest und Lockfile verwenden jetzt `filetandem`, der Publisher
bleibt `RootShellForge`; die Ziel-ID lautet `RootShellForge.filetandem`.
Die neue Identität wird mit Version 1.0.3 ausgeliefert.

Eine bereits versendete Mail oder ein vorhandenes Marketplace-Paket wird durch
lokale Änderungen nicht geändert. Die Veröffentlichung wird separat im Release-Nachweis dokumentiert.
Die Identitätsbildung beschreibt das [VS-Code-Manifest](https://code.visualstudio.com/api/references/extension-manifest).

## Bestehende Installationen

`RootShellForge.xscp`, `xscp-dev.xscp` und `RootShellForge.filetandem` sind
unterschiedliche Erweiterungsidentitäten. Es gibt keine automatische Übernahme
von Profilen, SecretStorage, Host-Key-Vertrauen oder Transferjournalen über diese
Grenze. Die interne Speicherschlüssel-Migration ändert daran nichts.

Vor dem Umstieg Transfers und automatische Überwachung beenden, eigene alte
Teil-Dateien bei Bedarf mit der bisherigen Erweiterung bereinigen und
**Profile ohne Geheimnisse exportieren** ausführen. Die bisherige Erweiterung
deaktivieren, bevor die neue aktiviert wird, um doppelte Befehle und Ansichten
zu vermeiden. Profile anhand des Exports neu anlegen, Zugangsdaten erneut
hinterlegen und Host-Keys unabhängig prüfen. Alte Aufträge werden nicht fortgesetzt.
Einstellungen unter `filetandem.*` bleiben als VS-Code-Einstellungen erhalten.

## Suchumfang und bewusst erhaltene Altkennungen

Durchsucht wurden versionierte Erweiterungsdateien, Skripte, Tests,
Dokumentation und das separate Website-Repository einschließlich DE/EN.

- Aktive Paket- und Testidentitäten, Testvariablen (`FILETANDEM_*`),
  Fixture-Namen, temporäre Dateien und aktuelle Produkttexte wurden umgestellt.
- Neue Transfer-/Editor-Dateien heißen `.filetandem-….part`; die Ausschlussregel
  erkennt zusätzlich alte `.xscp-….part`-Dateien. Sie werden nicht blind gelöscht.
- `src/application/namespace-migration.js`, der Migrationstest und dessen
  Unit-Tests benötigen die alten Speicherschlüssel als Eingaben.
- `src/extension.js` behält `xscp.*` als unsichtbare Befehlsaliasse für bestehende
  Tastenkürzel. Aktuelle Befehle und sichtbare Texte verwenden FileTandem.
- Historische Nachweise, Archiv, frühere Release-Berichte und der damalige
  Publisherwechsel behalten die tatsächlich geprüften Namen.
- Das bereits vorhandene externe Colima-Profil `xscp` / `colima-xscp` wird nicht
  durch Umbenennung von Quelltext umbenannt. Seine Start-/Stoppbefehle bleiben gültig.
  Vor Nutzung der umbenannten Fixtures alte Fixture-Container mit dem alten
  Skriptstand stoppen; danach Fixtures neu initialisieren/starten. Generierte
  SSH-Konfigurationen werden nicht als aktuelle Quelldateien umgeschrieben.
- Ignorierte alte VSIX-Dateien, Logs, Testprofile, Abhängigkeiten und Git-Historie
  bleiben historische/lokale Artefakte; vorhandene VSIX-Dateien enthalten weiterhin
  ihre bisherige Identität und dürfen nicht als umbenannte Pakete ausgegeben werden.

## Prüfung und Auslieferung

Der [Release-Nachweis 1.0.3](nachweise/Release-1.0.3.md) dokumentiert die
Paketprüfung, isolierte Installation und Veröffentlichung. Der vollständige
[VSIX-Releaseprozess](vsix-releaseprozess.md) gilt einschließlich Commit/Push.
Die Website bleibt lokal; kein Deployment. Layout und Screenshots sind unverändert.
