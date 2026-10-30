# Sprache in FileTandem

FileTandem übernimmt standardmäßig die Anzeigesprache von VS Code. Deutsch und Englisch sind verfügbar; für andere Editorsprachen wird Englisch verwendet. Nach einem Wechsel der VS-Code-Anzeigesprache und dem von VS Code angeforderten Neustart folgen Dateimanager, Dialoge und Befehle der neuen Sprache.

Die Einstellung `filetandem.language` steht standardmäßig auf `auto`. Optional lassen sich die FileTandem-Dialoge und der Dateimanager mit `de` oder `en` überschreiben. Die Befehle und Titel aus dem Erweiterungsmanifest folgen weiterhin der Editorsprache.

## Übersetzungen pflegen

- UI-Code verwendet englische Ausgangstexte. Native Dialoge werden über `src/vscode/localized-vscode.js` an `vscode.l10n.t` angebunden.
- `package.nls.json` und `package.nls.de.json` übersetzen die statischen Beiträge des Manifests, etwa Befehlsnamen und Einstellungen.
- `l10n/bundle.l10n.json` enthält die englischen Nachrichtenschlüssel; `l10n/bundle.l10n.de.json` deren deutsche Übersetzungen. `package.json` verweist mit `l10n` auf diesen Ordner.
- `l10n/source-messages.json` ist die gemeinsame Quelle für diese Bundles und enthält zusätzlich die bisherigen deutschen Nachrichtenschlüssel. Damit bleiben auch ältere gespeicherte Transferfehler übersetzbar. Interne Fehler werden erst an der Oberfläche lokalisiert.
- Die Webview nutzt dieselben Ressourcen und erhält ihre Sprache vom Extension Host. Dateipfade, eingegebene Werte, SSH-Fingerprints und technische Protokollwerte werden nicht als zu übersetzende UI-Texte behandelt.

Neue Texte mit ihrer deutschen Übersetzung in `source-messages.json` aufnehmen, dann `npm run l10n:sync` ausführen. Platzhalter `{0}`, `{1}` usw. müssen in beiden Sprachen erhalten bleiben. Im Dateimanager Texte mit `t(...)` darstellen; native Dialoge über die lokalisierte VS-Code-Anbindung aufrufen. Technische Werte wie `directory`, `password` oder Befehls-IDs bleiben unverändert.

`npm run l10n:check` prüft, ob die Bundles aktuell sind. Die Qualitätsprüfung testet zusätzlich Platzhalter, automatische Sprachauswahl, übersetzte Dialogentscheidungen und die gerenderte Oberfläche auf Deutsch und Englisch. Die Paketprüfung verlangt beide Sprachbundles in der VSIX.

Nach `npm run package` prüft `npm run test:localization` die installierte VSIX in normalen, isolierten VS-Code-Fenstern auf Englisch und Deutsch. Dafür wird das offizielle deutsche Sprachpaket in das temporäre Testprofil installiert. Die Prüfung verwendet `vscode.l10n` im Kontext der installierten Erweiterung und prüft außerdem den Webview-Handshake.

Grundlage: [Microsofts Lokalisierungsanleitung](https://github.com/microsoft/vscode-l10n) und [VS Code l10n API](https://code.visualstudio.com/api/references/vscode-api#l10n).
