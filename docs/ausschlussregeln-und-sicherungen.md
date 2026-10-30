# Ausschlussregeln und Löschsicherungen

Die Optionen findest du über das Zahnrad im FileTandem-Dateimanager, **FileTandem: Einstellungen öffnen** oder die VS-Code-Einstellungen unter `@ext:xscp-dev.xscp`. Alle Texte stehen auf Deutsch und Englisch zur Verfügung.

## Ausschlüsse

| Einstellung | Verhalten | Standard |
| --- | --- | --- |
| `filetandem.excludedExtensions` | Dateiendungen wie `.log`, `tmp` oder `.tar.gz` ausschließen. Nur Dateien, keine Ordner mit ähnlich endendem Namen. | Leer |
| `filetandem.excludedNames` | Datei-/Ordnernamen ausschließen, einschließlich Unterordnern. `*` steht für beliebige Zeichen, `?` für ein Zeichen; keine Pfade. | `.git`, `.vscode`, `.env`, `.env.*`, `node_modules` |
| `filetandem.excludeHidden` | Alle Punktdateien und Punktordner ausschließen. | Aus |
| `filetandem.backupRemoteDeletes` | Remote-Löschungen durch Umbenennen sichern. | An |

Namen und Endungen werden ohne Unterscheidung der Groß-/Kleinschreibung verglichen. Ordnernamen wirken auf den gesamten darunterliegenden Baum. Bei ungültigen Regeln wird die Operation abgebrochen, statt unbemerkt ohne Ausschlüsse weiterzuarbeiten.

Beispiel in den VS-Code-Einstellungen:

```json
{
  "filetandem.excludedExtensions": [".log", ".tmp", ".map"],
  "filetandem.excludedNames": [".git", ".vscode", ".env", ".env.*", "node_modules", "cache*"],
  "filetandem.excludeHidden": false,
  "filetandem.backupRemoteDeletes": true
}
```

Die Regeln gelten für Uploads und Downloads, auch aus dem Explorer, rekursive Transfers, Ordnerabgleich und automatische Überwachung. Beim Spiegeln bleiben ausgeschlossene Remote-Einträge erhalten. Vorhandene `.bak`- und `.bak.N`-Sicherungen sowie eigene `.xscp-….part`-Transferdateien sind immer ausgeschlossen, auch bei ansonsten leeren Regeln.

Die Einträge bleiben im Dateimanager sichtbar und werden mit **Ausgeschlossen** gekennzeichnet. Der Schalter **Versteckte Dateien** ändert nur die Anzeige, nicht die Ausschlussregeln. Direkt ausgeschlossene Einträge können nicht übertragen werden; ausgeschlossene Unterordner werden nicht durchlaufen.

Bewusst gewähltes manuelles Umbenennen, Wiederherstellen und Löschen bleibt möglich. Ausschlüsse schützen Transfers und automatische Aktionen; sie ersetzen keine Zugriffsrechte. Regeländerungen beenden eine laufende Überwachung. Wartende Transfers verwenden die aktuellen Regeln; bei einer Regeländerung während eines Transfers bleibt ein bestehendes Ziel geschützt.

## Sicherung statt Remote-Löschen

Bei aktivierten Löschsicherungen wird ein manuell ausgewählter Eintrag neben dem Original umbenannt:

- `index.php` → `index.php.bak`
- Falls dieser Name schon belegt ist: `index.php.bak.1`, danach `.bak.2` usw.
- Ein ausgewählter Ordner wird als Ganzes in `ordner.bak` umbenannt. Symlinks werden als Links umbenannt, ihre Ziele werden nicht durchlaufen.

Vorhandene Sicherungen werden nicht überschrieben. Ist die Quelle inzwischen verändert worden, fehlt die Freigabe oder kann kein Sicherungsname angelegt werden, stoppt die Operation. Es gibt keinen stillen Rückfall auf endgültiges Löschen.

**Bei Websites ist besondere Sorgfalt nötig:** Eine Datei wie `config.php.bak` kann vom Webserver als Download ausgeliefert werden und dadurch Quelltext oder Zugangsdaten offenlegen. Den Zugriff auf Sicherungsdateien und Sicherungsordner im Webserver sperren. Die Bestätigungsdialoge und die Einstellung weisen darauf hin. FileTandem kann die Webserver-Konfiguration nicht selbst prüfen.

Lokal wird weiterhin der Betriebssystem-Papierkorb verwendet. Scheitert der Papierkorb, wird nicht endgültig gelöscht.

## Automatischer Abgleich

Automatisch entfernte Remote-Dateien werden ebenfalls in `.bak` umbenannt. Ordner, die danach Sicherungen oder ausgeschlossene Einträge enthalten, bleiben erhalten. Leere Ordner können entfernt werden. Sicherungen werden bei einem erneuten Start weder hochgeladen noch gelöscht oder erneut gesichert.

Bei einem Ordner-zu-Datei-Typkonflikt wird mit aktivierten Sicherungen vor der Bereinigung angehalten: Ein darin aufbewahrtes Backup würde die anschließende Dateianlage blockieren. Den Konflikt dann im Dateimanager manuell lösen. Auch bei deaktivierten Sicherungen werden Typkonflikte mit ausgeschlossenen Remote-Einträgen nicht automatisch bereinigt.

Uploads ersetzen weiterhin bestehende Dateien nach den normalen Konfliktprüfungen. Diese Funktion sichert **Löschungen**, nicht jede frühere Dateiversion beim Überschreiben.

## Wiederherstellen und Aufräumen

Eine Remote-Sicherung auswählen und **Sicherung wiederherstellen** anklicken. `.bak` bzw. `.bak.N` wird entfernt. Existiert der Originalname schon, wird die Wiederherstellung verweigert; das vorhandene Original zuerst unter einem anderen Namen aufbewahren. Alternativ ist manuelles Umbenennen möglich.

Um eine Sicherung endgültig zu entfernen, ausschließlich die betreffenden Sicherungen auswählen und **Löschen** wählen. Der native Dialog verlangt eine Bestätigung für endgültiges Löschen. Sicherungen und normale Einträge müssen dafür getrennt ausgewählt werden.

Es gibt keine automatische Bereinigung oder Aufbewahrungsfrist. Sicherungen belegen weiter Speicherplatz und schützen nicht vor einem Verlust des gesamten Servers. Sie sind kein Ersatz für unabhängige Backups.

## Prüfung

- `npm run quality`: Regeln, Namenskollisionen, Wiederherstellung, geschützte Remote-Einträge, Überwachungsänderungen und gerenderte Bedienung.
- Mit eigenen laufenden SSH-Fixtures: `npm run test:file-options` prüft echte SFTP-/SCP-Transfers, Sicherungen ohne Überschreiben, Wiederherstellung und Regeländerungen vor der Veröffentlichung.
- `npm run test:auto-upload` prüft zusätzlich den bisherigen Modus ohne Löschsicherungen.
