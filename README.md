# xScp

Entwicklungsprototyp einer VS-Code-Desktop-Erweiterung für SFTP und SCP. M0 ist abgeschlossen: Start-Webview, SFTP-Streaming, echtes SCP, Authentifizierung und abgesicherter SFTP-Editor sind nachgewiesen. Die Dateimanager-Oberfläche bietet noch keine Transfers.

## Entwicklung

Voraussetzungen: Node.js ab 22.13.1 mit npm sowie **VS Code Desktop ab 1.140.0**. macOS/Apple Silicon ist geprüft; Windows/Linux sind noch nicht abgenommen. Anwender der späteren VSIX benötigen kein separat installiertes Node/npm. [Technische Entscheidungen](docs/entscheidungen.md) · [Kompatibilität](docs/kompatibilitaet.md).

```sh
# Mit nvm, falls vorhanden:
nvm use
npm ci
npm run build
npm start
```

Im Extension Development Host die Befehlspalette öffnen und **xScp: Dateimanager öffnen** ausführen. Dies funktioniert auch ohne Projektordner. Alternativ dieses Repository in VS Code öffnen und mit **F5** die Konfiguration **xScp: Extension Development Host** starten; der Build läuft zuvor automatisch.

`npm start` findet auf macOS die Standardinstallation unter `/Applications/Visual Studio Code.app`. Auf Linux/Windows muss die Code-CLI im PATH liegen. Für andere Installationen `VSCODE_EXECUTABLE` auf den vollständigen Code-CLI-Pfad setzen (unter Windows `code.cmd`). Nur macOS ist bislang geprüft.

```sh
npm run watch  # beide Bundles bei Änderungen neu bauen; Host anschließend neu laden
npm run check  # JavaScript-Syntax prüfen
npm test       # echter Extension-Host-Smoke-Test; lädt die geprüfte Mindestversion VS Code 1.140.0 bei Bedarf
```

Für Tests mit einer vorhandenen Installation kann `VSCODE_TEST_EXECUTABLE` auf die VS-Code-Programmdatei gesetzt werden (macOS: `/Applications/Visual Studio Code.app/Contents/MacOS/Code`). Start und Tests verwenden separate VS-Code-Entwicklungs-/Testprofile unter `.vscode-test/`. Bei sehr langen Checkout-Pfaden kann VS Code unter macOS an der Socket-Pfadgrenze scheitern; dann das Repository unter einem kürzeren Pfad auschecken. Der automatisierte Test prüft Aktivierung, Befehl und Webview-Tab; die sichtbare React-Ausgabe zusätzlich manuell prüfen.

## Aufbau

- `src/extension.js`: ES-Modul mit VS-Code-Befehl und Webview-Lifecycle.
- `webview/src/`: React/JSX und Theme-CSS für den Browser.
- `scripts/build.mjs`: esbuild erzeugt `dist/extension.cjs` für Node sowie `dist/webview.js` und `dist/webview.css` für die Webview. `vscode` bleibt extern; Source Maps unterstützen Debugging.
- `jsconfig.json`: JavaScript/JSX-Projekt und Editor-Unterstützung mit VS-Code-Typen und JSDoc; kein TypeScript-Compiler.

Die Webview nutzt nur lokale Assets mit CSP. Restricted Mode deaktiviert die Erweiterung. `extensionKind: ["ui"]` bindet die Erweiterung an den lokalen Desktop-Host; Private VSIX-Installation ist nachgewiesen; CI und vollständige Oberfläche folgen in späteren Items.

[M0-02-Nachweis und Remote-Prüfschritte](docs/nachweise/M0-02.md) · [Backlog](docs/meilensteine/README.md) · [Umsetzungsplan](UMSETZUNGSPLAN.md) · [M0-01-Nachweis](docs/nachweise/M0-01.md)

Build-Konzept nach der [offiziellen VS-Code-Anleitung](https://code.visualstudio.com/api/working-with-extensions/bundling-extension), Host-Tests nach [Testing Extensions](https://code.visualstudio.com/api/working-with-extensions/testing-extension).

## Lokaler Ausführungsort (M0-02)

Die Dateiquelle „Lokal · Mein Rechner“ ist das Desktop-Dateisystem, auch bei einem Remote-Workspace. Der Befehl **xScp: Lokalen Dateizugriff nachweisen** öffnet eine Dateiauswahl mit lokalem `file:`-Startpfad im Home-Verzeichnis. Eine bewusst erstellte, kleine Testdatei auswählen; der Ausgabekanal **xScp: Ausführungsort** zeigt Ausführungsart, Remote-Fenster-Kontext, Betriebssystem, Hostnamen, lokale Datei, Bytezahl und SHA-256. Dateiinhalt wird nicht ausgegeben. Der Dateipfad und Hostname dienen dem lokalen technischen Nachweis; vor Weitergabe des Protokolls gegebenenfalls kürzen.

`npm test` prüft den lokalen Zugriff gegen einen vom Desktop-Teststarter erzeugten Zufallsmarker. Der Marker wird anschließend entfernt. Der tatsächliche Remote-SSH-Nachweis ist mit der kompatiblen isolierten Debian-Fixture aus M0-08 bestanden. Der zuvor angebotene externe Server war nur für VS Code Server inkompatibel; eine solche Serverinstallation ist keine Voraussetzung für xScp-SFTP/SCP. Vorgehen und automatischer Remote-Test stehen im [Nachweis](docs/nachweise/M0-02.md). Eine `remote.extensionKind`-Übersteuerung auf `workspace` wird nicht unterstützt. Remote-Workspace-URIs werden nie als lokale Pfade gelesen. Der Prototyp-Nachweis akzeptiert keine `file:`-Authority/UNC-Pfade; Windows-/UNC-Unterstützung bleibt separat zu testen.

## SSH-Testumgebungen (M0-03)

Drei isolierte OpenSSH-Protokoll-Container stellen SFTP, SFTP-only ohne Shell und echtes SCP ohne SFTP bereit; M0-07 ergänzt eine Auth-Fixture, M0-08 eine separate Remote-SSH-Fixture. Sie sind ausschließlich über Loopback erreichbar und verwenden lokal erzeugte disposable Testkeys. Mit laufender lokaler Docker-Laufzeit:

```sh
npm run fixtures:start
npm run fixtures:verify
npm run fixtures:stop
```

Auf diesem Mac wurde dafür das separate Colima-Profil `xscp` eingerichtet; nach der Abnahme ist es gestoppt. Für den nächsten Lauf `colima start xscp --activate=false` und `export XSCP_DOCKER_CONTEXT=colima-xscp` ausführen. Alle Zugänge, Voraussetzungen, Reset und Details stehen in der [Fixture-Anleitung](test/fixtures/ssh/README.md). Der [M0-03-Nachweis](docs/nachweise/M0-03.md) dokumentiert die Abnahme. Produktive Server werden für diese Fixtures nicht verwendet.

## SSH-Host-Key-Prüfung (M0-04)

**xScp: SSH-Host-Key prüfen** in der Befehlspalette startet einen minimalen SSH-Nachweis: Host, Port, Benutzer und eine lokale unverschlüsselte private Testschlüsseldatei auswählen. Für die Fixtures `127.0.0.1`, Port `22220`/`22221`/`22222`, Benutzer `fixture` und `test/fixtures/ssh/.runtime/client_ed25519` verwenden. Der Befehl authentifiziert sich und schließt die Verbindung anschließend wieder; SFTP-Streaming und echtes SCP sind separat in M0-05/M0-06 nachgewiesen.

Ein unbekannter Host-Key wird mit Algorithmus und OpenSSH-SHA-256-Fingerprint im nativen Dialog angezeigt. Den Fingerprint unabhängig vergleichen, dann ausdrücklich **Vertrauen und verbinden** wählen. **Ablehnen** oder Schließen des Dialogs beendet die Verbindung. Für die kontrollierten Fixtures zeigt `ssh-keygen -lf test/fixtures/ssh/.runtime/servers/<variante>/host_ed25519.pub` den erwarteten Fingerprint.

Bestätigte öffentliche Host Keys werden im lokalen Erweiterungsspeicher getrennt von Zugangsdaten für **Host und Port** gespeichert; kein Settings Sync. Eine Wiederverbindung prüft den vollständigen Schlüssel. Bei Änderungen wird blockiert und der alte sowie neue Fingerprint angezeigt. Dieser Prototyp bietet noch keinen Befehl zum Entfernen/Ersetzen von Vertrauen; einen Schlüsselwechsel zunächst unabhängig klären. Ein Fixture-Key-Reset führt daher bei zuvor vertrauten Ports erwartungsgemäß zur Blockade. Ein frisches Development-Testprofil hat einen leeren Trust-Speicher.

```sh
npm run test:unit       # Policy, Speicherfehler, Parallelität und Dialogentscheidungen
# Laufende Fixtures vorausgesetzt; ggf. XSCP_DOCKER_CONTEXT=colima-xscp setzen:
npm run test:host-keys  # echte SSH-Ablehnung, Zustimmung, Wiederverbindung und Key-Rotation
npm test               # Unit-Tests plus Build und echter Extension-Host-Smoke-Test
```

Die Integrationstests ändern ausschließlich Schlüssel innerhalb eigener Fixture-Container und stellen die Originalschlüssel anschließend wieder her. Sie verwenden einen eigenen Test-Trust-Speicher, nicht den Trust-Speicher deines VS-Code-Profils. `ssh2` wird in das Host-Bundle eingebunden; optionale native Beschleuniger sind nicht Teil der VSIX. Bibliothekslizenzen stehen in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). Details und Grenzen: [M0-04-Nachweis](docs/nachweise/M0-04.md).

## SFTP-Streaming (M0-05)

Der technische Adapter `src/adapters/sftp/transfer.js` streamt Upload und Download auf einer durch `connectSsh` verifizierten Sitzung. Er benötigt ausschließlich SFTP, keine Shell. 64-KiB-Puffer und Node-Pipeline sorgen für Backpressure; das Ergebnis enthält Bytezahl und SHA-256. `AbortSignal` bricht den Transfer ab. Jede Operation schließt ihre Streams und die eigene SSH-Sitzung, auch bei Fehlern. Absolute lokale und entfernte Pfade sind erforderlich.

```sh
# Nach fixtures:start, mit laufender lokaler Docker-Laufzeit:
npm run test:sftp
```

Die vier Integrationstests prüfen normale SFTP- und SFTP-only-Server: gut 32 MiB in beide Richtungen, unabhängiger OpenSSH-Hashvergleich, Leerdateien, Sonderzeichen im Dateinamen, Abbruch, vorhandene Ziele und fehlende Quellen. Der Server ohne SFTP wird ohne Shell-Fallback abgewiesen. Ein separater Bundle-Test prüft den Adapter außerhalb von `node_modules`.

Ziele werden exklusiv neu angelegt (`wx`); vorhandene Dateien werden nicht überschrieben. Nach Abbruch/Fehler können Teil-Dateien zurückbleiben. Atomare Veröffentlichung, Wiederaufnahme, Konfliktentscheidungen, Queue und die Transfer-Oberfläche folgen in M3. Fortschritt zählt durchgereichte Bytes und bestätigt keine dauerhafte Speicherung auf dem Server. [Nachweis und Grenzen](docs/nachweise/M0-05.md).

## Echtes SCP (M0-06)

`src/adapters/scp/transfer.js` überträgt einzelne reguläre Dateien über SSH-Exec mit serverseitigem `scp -t`/`scp -f`. Es fordert kein SFTP an. `list.js` weist eine Verzeichnisauflistung mit NUL-getrennten GNU-find-Metadaten nach. Beide APIs übernehmen eine bereits host-key-geprüfte `connectSsh`-Sitzung und schließen sie nach genau einer Operation.

```sh
# Laufende M0-03-Fixtures vorausgesetzt:
npm run test:scp
```

Geprüft sind Linux/OpenSSH mit POSIX-Shell, vorhandenem `scp`, GNU find/coreutils und `grep`. Kein VS Code Server wird benötigt. SFTP-only ohne Exec reicht für SCP nicht; es gibt keinen stillen Protokoll-Fallback. BSD/macOS-, BusyBox- und Windows-SCP-Server sind bislang nicht freigegeben.

Absolute POSIX-Pfade werden als einzelne Shell-Argumente quotiert, mit `--` von Optionen getrennt. Leerzeichen, Quotes, Unicode und Shell-Sonderzeichen funktionieren wörtlich. Steuerzeichen, Zeilenumbrüche, Backslashes, `.`/`..`-Komponenten und nicht verlustfrei darstellbare UTF-8-Namen werden für diesen SCP-Weg abgewiesen; dafür SFTP verwenden. Die GNU-Liste kann Namen mit Zeilenumbrüchen anzeigen und kennzeichnet sie als nicht transferierbar. Symlink-/Verzeichniseinträge werden nur angezeigt, nicht rekursiv übertragen.

Der Prototyp unterstützt höchstens 1 GiB pro Datei, 4096 Bytes pro SCP-Header und 1 MiB pro Verzeichnisliste. Lokale Ziele entstehen exklusiv; Upload-Ziele werden mit Shell-`noclobber` reserviert. Vorhandene Dateien werden in den geprüften Fällen erhalten. Das ist noch keine atomare Veröffentlichung und schützt nicht vor gleichzeitigen Änderungen durch andere Serverprozesse. Bei Fehler/Abbruch können eigene Teil-Dateien bleiben. Vollständige Parser-Härtung, Integration, Rekursion und Finalisierung folgen in M4. [Nachweis und Grenzen](docs/nachweise/M0-06.md).

## Authentifizierung und Packaging (M0-07)

Der gemeinsame SSH-Adapter unterstützt Passwort, private Ed25519-/RSA-Schlüssel mit optionaler Passphrase, einen ausdrücklich angegebenen Agent-Socket und `keyboardInteractive(request)` als Antwort-Callback. Host-Key-Prüfung bleibt verpflichtend; Agent Forwarding und beliebige `authHandler`-/Algorithmus-Overrides sind ausgeschlossen. Der Callback erhält Serverprompts inklusive `echo`, Endpoint und AbortSignal; er liefert genau eine String-Antwort pro Prompt. Antworten werden weder automatisch aus dem Passwort übernommen noch gespeichert/protokolliert. Die Befehlspalette bietet weiterhin die bisherige Key-Probe; vollständige Profil-/Anmeldedialoge folgen in M2. Die technische Extension-API `probeSshAuthentication` weist weitere Verfahren nach und schließt ihre Sitzung immer.

```sh
# Laufende Fixtures vorausgesetzt; ggf. XSCP_DOCKER_CONTEXT=colima-xscp:
npm run test:auth
# Frische private VSIX, Inhaltsprüfung, isolierte Installation und echte Auth-Tests:
VSCODE_TEST_EXECUTABLE="/Applications/Visual Studio Code.app/Contents/MacOS/Code" npm run test:packaging
```

Packaging-Abnahme benötigt Python 3 für ZIP-Prüfung, npm (vsce 4.0.0 wird bei Bedarf in den Cache geladen), VS Code und die Fixture-Testzugänge. Paket/Profile/Agent werden nach dem Test entfernt. Die tatsächliche VSIX aktiviert und authentifiziert sich außerhalb des Entwicklungscheckouts ohne `node_modules`, optionale native SSH-Addons oder Testzugänge im Paket.

macOS/Apple Silicon ist mit Passwort, unverschlüsselten und verschlüsselten Ed25519-/RSA-OpenSSH-Keys, Unix-Agent und OpenSSH/PAM-Keyboard-Interactive geprüft. Linux-Desktop und Windows-Agent sind mangels Testsystem offen. Windows-Named-Pipe-Syntax ist lediglich validiert, keine Windows-Abnahme. Pageant/Cygwin werden ausdrücklich abgewiesen, da ihre Helfer nicht paketiert werden. RSA funktioniert ohne Aktivierung von RSA/SHA-1. Grenzen und vollständige [Ergebnismatrix](docs/nachweise/M0-07.md).

## SFTP-Editor-Prototyp (M0-08)

**xScp: SFTP-Datei im Editor öffnen** öffnet eine bestehende reguläre Datei bis 10 MiB zunächst schreibgeschützt. Host, Port, Benutzer, absoluter Remote-Pfad und lokaler privater Testschlüssel werden abgefragt; für die SFTP-only-Fixture Port `22221` verwenden. Die Host-Key-Prüfung bleibt verpflichtend.

**Remote-Bearbeitung freigeben** verlangt eine ausdrückliche Bestätigung: Speichern und Auto Save schreiben direkt auf den Server. Die Freigabe gilt nur für die ausgewählte Datei/Sitzung. Die Statusleiste zeigt den Zustand und ermöglicht Freigeben bzw. Sperren. Schließen/Neustart verwirft die Freigabe. Bei Konflikten bleiben Änderungen ungespeichert; Datei neu öffnen und Inhalte abgleichen.

```sh
# Laufende Fixtures und echte lokale VS-Code-Programmdatei vorausgesetzt:
export VSCODE_TEST_EXECUTABLE="/Applications/Visual Studio Code.app/Contents/MacOS/Code"
npm run test:editor
# Zusätzlich lokal installierte Remote-SSH 0.128.0 / Remote-SSH-Edit 0.87.0:
npm run test:editor:remote
```

Der Remote-Test verwendet die separate Debian-Fixture auf Port `22224` und ein isoliertes VS-Code-Profil. Lokales Fenster, echtes Remote-SSH-Fenster, Auto Save, Konflikte und Zugriff aus einer Remote-Workspace-Erweiterung sind geprüft. Der bislang offene technische M0-02-Remote-Nachweis ist damit ebenfalls abgeschlossen. Kein Push-Watching fremder Serveränderungen, keine großen Dateien, keine dauerhaften Editorsitzungen; vollständige Editorintegration folgt in M5. [Nachweis und Grenzen](docs/nachweise/M0-08.md).

## Abschluss M0 und weiterer Aufwand

[M0-09](docs/nachweise/M0-09.md) schließt alle neun technischen Nachweise ab. `ssh2` und beide Protokollwege bleiben gewählt; VS-Code-Untergrenze, Serverfähigkeiten, Paketstrategie und Ersatzwege sind verbindlich dokumentiert. Nächster Schritt ist M1-01. Restaufwand M1–M6: 31–46 Personenarbeitstage, mit Reserve 38–56; [Begründung](docs/entscheidungen.md#d10--aufwand-und-übergang-in-m1). M0-Abschluss ist keine Freigabe der noch fehlenden Produktmodule oder der ungeprüften Plattformen.
