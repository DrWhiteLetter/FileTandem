# Wechsel zum Marketplace-Publisher RootShellForge

> Historischer Stand des Publisherwechsels. Der anschließende, lokal vorbereitete Paketnamenswechsel ist unter [Technische Umbenennung](identitaetswechsel-filetandem.md) dokumentiert.

Stand: 07.11.2026. Der Benutzer hat die Publisher-ID `RootShellForge` vorgegeben. Das Manifest verwendet diese ID; der Paketname `xscp` und der sichtbare Produktname FileTandem bleiben erhalten. Die Version bleibt 1.0.1. Das neu gebaute Paket ist für den Upload unter dem neuen Publisher bestimmt; bereits veröffentlichte GitHub-Assets werden dadurch nicht geändert.

## Auswirkungen auf vorhandene Installationen

Die bisherige Entwicklungsidentität `xscp-dev.xscp` und die neue Identität `RootShellForge.xscp` sind für VS Code unterschiedliche Erweiterungen. Die neue Erweiterung übernimmt gespeicherte Profile, Host-Key-Vertrauen, Zugangsdaten und Transferjournale der alten Identität nicht automatisch. Es werden keine fremden Speicherdateien ausgelesen oder verändert. Einstellungen unter `filetandem.*` bleiben als VS-Code-Einstellungen bestehen.

Vor dem Umstieg laufende Übertragungen und automatische Überwachung beenden. Benötigte Profilangaben mit der bisherigen Erweiterung über **FileTandem: Profile ohne Geheimnisse exportieren** sichern; der Export enthält keine Passwörter. Die alte Erweiterung anschließend deaktivieren, damit identische Befehle und Ansichten nicht gleichzeitig registriert werden. Nach Installation der neuen VSIX benötigte Profile anhand des Exports neu anlegen, Zugangsdaten erneut hinterlegen und Host-Keys unabhängig prüfen. Alte Aufträge werden nicht automatisch fortgesetzt.

Der Test `scripts/test-namespace-migration.mjs` prüft weiterhin den Wechsel der internen `xscp.*`-Speicherschlüssel zu `filetandem.*` innerhalb derselben Erweiterungsidentität. Er ist kein Nachweis einer automatischen Übernahme aus dem alten Publisher.

## Paket und Upload

`npm run package` erstellt `out/FileTandem-1.0.1.vsix` mit Publisher `RootShellForge` und eine SHA-256-Datei. Ein zuvor vorhandenes lokales Paket wurde vor dem Neubau unter `out/pre-RootShellForge/` gesichert. Für den manuellen Marketplace-Upload die neu gebaute Datei verwenden. Ein erfolgreicher lokaler Paket- oder Installationstest ist kein Nachweis eines abgeschlossenen Marketplace-Uploads.

Die Identitätsbildung aus Publisher und Paketname beschreibt die [VS-Code-Publishing-Dokumentation](https://code.visualstudio.com/api/working-with-extensions/publishing-extension); die Pflichtfelder stehen im [Extension Manifest](https://code.visualstudio.com/api/references/extension-manifest).
