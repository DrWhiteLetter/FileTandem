# FileTandem

Private Vorabversion **0.0.8** einer VS-Code-Desktop-Erweiterung für SFTP und SCP. Die Commander-Ansicht bietet lokale und entfernte Dateiverwaltung, rekursive Uploads/Downloads, Transferqueue, geprüfte SFTP-Fortsetzung und kontrollierte Remote-Bearbeitung. M0 bis M5 sind umgesetzt; M6 ergänzt die lokale Release-Härtung. Windows/Linux und vollständige 1.0-Freigabe bleiben offen. [Installation, Quickstart und Troubleshooting](docs/release-anleitung.md) · [Changelog](CHANGELOG.md) · [M6-Abnahme](docs/nachweise/M6-Lokal.md).

Der Projektordner heißt `FileTandem`; Paketierung erzeugt `out/FileTandem-<Version>.vsix` mit passender `.sha256`-Datei. Ältere lokale VSIX-Dateien wurden entsprechend umbenannt; historische Nachweise behalten ihre damaligen Dateinamen. Die technische Extension-ID bleibt bis zur Publisher-Festlegung erhalten.

## Entwicklung

Voraussetzungen: Node.js ab 22.13.1 mit npm sowie **VS Code Desktop ab 1.140.0**. macOS/Apple Silicon ist geprüft; Windows/Linux sind noch nicht abgenommen. Anwender der späteren VSIX benötigen kein separat installiertes Node/npm. [Technische Entscheidungen](docs/entscheidungen.md) · [Kompatibilität](docs/kompatibilitaet.md).

```sh
# Mit nvm, falls vorhanden:
nvm use
npm ci
npm run build
npm start
```

Im Extension Development Host die Befehlspalette öffnen und **FileTandem: Dateimanager öffnen** ausführen. Dies funktioniert auch ohne Projektordner. Alternativ dieses Repository in VS Code öffnen und mit **F5** die Konfiguration **FileTandem: Extension Development Host** starten; der Build läuft zuvor automatisch.

In der FileTandem-Seitenleiste öffnet der Logo-Button oben bei **Verbindungen** den Dateimanager mit einem Klick, auch ohne gespeichertes Serverprofil. Das blau-türkise Logo zeigt zwei Ordner mit Transferpfeilen; es dient außerdem als Erweiterungslogo.

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

Die Webview nutzt nur lokale Assets mit CSP. Restricted Mode deaktiviert die Erweiterung. `extensionKind: ["ui"]` bindet die Erweiterung an den lokalen Desktop-Host; Private VSIX-Installation ist nachgewiesen. Die Commander-Demo und eine CI-Grundlage sind enthalten; echte SFTP-Verbindungen und Dateiverwaltung sind angebunden; SFTP-Transfers mit Queue und Journal sind angebunden.

[M0-02-Nachweis und Remote-Prüfschritte](docs/nachweise/M0-02.md) · [Backlog](docs/meilensteine/README.md) · [Umsetzungsplan](UMSETZUNGSPLAN.md) · [M0-01-Nachweis](docs/nachweise/M0-01.md)

Build-Konzept nach der [offiziellen VS-Code-Anleitung](https://code.visualstudio.com/api/working-with-extensions/bundling-extension), Host-Tests nach [Testing Extensions](https://code.visualstudio.com/api/working-with-extensions/testing-extension).

## Lokaler Ausführungsort (M0-02)

Die Dateiquelle „Lokal · Mein Rechner“ ist das Desktop-Dateisystem, auch bei einem Remote-Workspace. Der Befehl **FileTandem: Lokalen Dateizugriff nachweisen** öffnet eine Dateiauswahl mit lokalem `file:`-Startpfad im Home-Verzeichnis. Eine bewusst erstellte, kleine Testdatei auswählen; der Ausgabekanal **FileTandem: Ausführungsort** zeigt Ausführungsart, Remote-Fenster-Kontext, Betriebssystem, Hostnamen, lokale Datei, Bytezahl und SHA-256. Dateiinhalt wird nicht ausgegeben. Der Dateipfad und Hostname dienen dem lokalen technischen Nachweis; vor Weitergabe des Protokolls gegebenenfalls kürzen.

`npm test` prüft den lokalen Zugriff gegen einen vom Desktop-Teststarter erzeugten Zufallsmarker. Der Marker wird anschließend entfernt. Der tatsächliche Remote-SSH-Nachweis ist mit der kompatiblen isolierten Debian-Fixture aus M0-08 bestanden. Der zuvor angebotene externe Server war nur für VS Code Server inkompatibel; eine solche Serverinstallation ist keine Voraussetzung für FileTandem-SFTP/SCP. Vorgehen und automatischer Remote-Test stehen im [Nachweis](docs/nachweise/M0-02.md). Eine `remote.extensionKind`-Übersteuerung auf `workspace` wird nicht unterstützt. Remote-Workspace-URIs werden nie als lokale Pfade gelesen. Der Prototyp-Nachweis akzeptiert keine `file:`-Authority/UNC-Pfade; Windows-/UNC-Unterstützung bleibt separat zu testen.

## SSH-Testumgebungen (M0-03)

Drei isolierte OpenSSH-Protokoll-Container stellen SFTP, SFTP-only ohne Shell und echtes SCP ohne SFTP bereit; M0-07 ergänzt eine Auth-Fixture, M0-08 eine separate Remote-SSH-Fixture. Sie sind ausschließlich über Loopback erreichbar und verwenden lokal erzeugte disposable Testkeys. Mit laufender lokaler Docker-Laufzeit:

```sh
npm run fixtures:start
npm run fixtures:verify
npm run fixtures:stop
```

Auf diesem Mac wurde dafür das separate Colima-Profil `xscp` eingerichtet; nach der Abnahme ist es gestoppt. Für den nächsten Lauf `colima start xscp --activate=false` und `export XSCP_DOCKER_CONTEXT=colima-xscp` ausführen. Alle Zugänge, Voraussetzungen, Reset und Details stehen in der [Fixture-Anleitung](test/fixtures/ssh/README.md). Der [M0-03-Nachweis](docs/nachweise/M0-03.md) dokumentiert die Abnahme. Produktive Server werden für diese Fixtures nicht verwendet.

## SSH-Host-Key-Prüfung (M0-04)

**FileTandem: SSH-Host-Key prüfen** in der Befehlspalette startet einen minimalen SSH-Nachweis: Host, Port, Benutzer und eine lokale unverschlüsselte private Testschlüsseldatei auswählen. Für die Fixtures `127.0.0.1`, Port `22220`/`22221`/`22222`, Benutzer `fixture` und `test/fixtures/ssh/.runtime/client_ed25519` verwenden. Der Befehl authentifiziert sich und schließt die Verbindung anschließend wieder; SFTP-Streaming und echtes SCP sind separat in M0-05/M0-06 nachgewiesen.

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

Ziele werden exklusiv neu angelegt (`wx`); vorhandene Dateien werden nicht überschrieben. Nach Abbruch/Fehler können Teil-Dateien zurückbleiben. Die SFTP-Alpha ergänzt atomare Veröffentlichung, Konfliktentscheidungen, Queue und Journal; geprüfte SFTP-Fortsetzung ist seit M4 verfügbar. Fortschritt zählt durchgereichte Bytes und bestätigt keine dauerhafte Speicherung auf dem Server. [Nachweis und Grenzen](docs/nachweise/M0-05.md).

## Echtes SCP (M0-06)

`src/adapters/scp/transfer.js` überträgt einzelne reguläre Dateien über SSH-Exec mit serverseitigem `scp -t`/`scp -f`. Es fordert kein SFTP an. `list.js` weist eine Verzeichnisauflistung mit NUL-getrennten GNU-find-Metadaten nach. Beide APIs übernehmen eine bereits host-key-geprüfte `connectSsh`-Sitzung und schließen sie nach genau einer Operation.

```sh
# Laufende M0-03-Fixtures vorausgesetzt:
npm run test:scp
```

Geprüft sind Linux/OpenSSH mit POSIX-Shell, vorhandenem `scp`, GNU find/coreutils und `grep`. Kein VS Code Server wird benötigt. SFTP-only ohne Exec reicht für SCP nicht; es gibt keinen stillen Protokoll-Fallback. BSD/macOS-, BusyBox- und Windows-SCP-Server sind bislang nicht freigegeben.

Absolute POSIX-Pfade werden als einzelne Shell-Argumente quotiert, mit `--` von Optionen getrennt. Leerzeichen, Quotes, Unicode und Shell-Sonderzeichen funktionieren wörtlich. Steuerzeichen, Zeilenumbrüche, Backslashes, `.`/`..`-Komponenten und nicht verlustfrei darstellbare UTF-8-Namen werden für diesen SCP-Weg abgewiesen; dafür SFTP verwenden. Die GNU-Liste kann Namen mit Zeilenumbrüchen anzeigen und kennzeichnet sie als nicht transferierbar. Symlink-/Verzeichniseinträge werden nur angezeigt, nicht rekursiv übertragen.

Der ursprüngliche M0-Prototyp begrenzte Dateien auf 1 GiB und Verzeichnislisten auf 1 MiB. M4 erlaubt sichere ganzzahlige Dateigrößen einschließlich über 4 GiB und begrenzt Listen auf 32 MiB/10.000 Einträge; Header bleiben auf 4096 Bytes begrenzt. Lokale Ziele entstehen exklusiv; Upload-Ziele werden mit Shell-`noclobber` reserviert. Vorhandene Dateien werden in den geprüften Fällen erhalten. Das ist noch keine atomare Veröffentlichung und schützt nicht vor gleichzeitigen Änderungen durch andere Serverprozesse. Bei Fehler/Abbruch können eigene Teil-Dateien bleiben. Parser-Härtung, Integration, Rekursion und sichere Finalisierung sind seit M4 implementiert; die beschriebene M0-Probe bleibt als separater technischer Test bestehen. [Aktuelle Bedienung und Grenzen](docs/nachweise/M4-Anleitung.md). [Nachweis und Grenzen](docs/nachweise/M0-06.md).

## Authentifizierung und Packaging (M0-07)

Der gemeinsame SSH-Adapter unterstützt Passwort, private Ed25519-/RSA-Schlüssel mit optionaler Passphrase, einen ausdrücklich angegebenen Agent-Socket und `keyboardInteractive(request)` als Antwort-Callback. Host-Key-Prüfung bleibt verpflichtend; Agent Forwarding und beliebige `authHandler`-/Algorithmus-Overrides sind ausgeschlossen. Der Callback erhält Serverprompts inklusive `echo`, Endpoint und AbortSignal; er liefert genau eine String-Antwort pro Prompt. Antworten werden weder automatisch aus dem Passwort übernommen noch gespeichert/protokolliert. Die Befehlspalette bietet weiterhin die bisherige Key-Probe; Profil-/Anmeldedialoge sind seit M2 vorhanden. Die technische Extension-API `probeSshAuthentication` weist weitere Verfahren nach und schließt ihre Sitzung immer.

```sh
# Laufende Fixtures vorausgesetzt; ggf. XSCP_DOCKER_CONTEXT=colima-xscp:
npm run test:auth
# Frische private VSIX, Inhaltsprüfung, isolierte Installation und echte Auth-Tests:
VSCODE_TEST_EXECUTABLE="/Applications/Visual Studio Code.app/Contents/MacOS/Code" npm run test:packaging
```

Packaging-Abnahme benötigt Python 3 für ZIP-Prüfung, npm (vsce 4.0.0 wird bei Bedarf in den Cache geladen), VS Code und die Fixture-Testzugänge. Paket/Profile/Agent werden nach dem Test entfernt. Die tatsächliche VSIX aktiviert und authentifiziert sich außerhalb des Entwicklungscheckouts ohne `node_modules`, optionale native SSH-Addons oder Testzugänge im Paket.

macOS/Apple Silicon ist mit Passwort, unverschlüsselten und verschlüsselten Ed25519-/RSA-OpenSSH-Keys, Unix-Agent und OpenSSH/PAM-Keyboard-Interactive geprüft. Linux-Desktop und Windows-Agent sind mangels Testsystem offen. Windows-Named-Pipe-Syntax ist lediglich validiert, keine Windows-Abnahme. Pageant/Cygwin werden ausdrücklich abgewiesen, da ihre Helfer nicht paketiert werden. RSA funktioniert ohne Aktivierung von RSA/SHA-1. Grenzen und vollständige [Ergebnismatrix](docs/nachweise/M0-07.md).

## SFTP-Editor-Prototyp (M0-08)

**FileTandem: SFTP-Datei im Editor öffnen** (technischer M0-Einzeldateitest) öffnet eine bestehende reguläre Datei bis 10 MiB zunächst schreibgeschützt. Host, Port, Benutzer, absoluter Remote-Pfad und lokaler privater Testschlüssel werden abgefragt; für die SFTP-only-Fixture Port `22221` verwenden. Die Host-Key-Prüfung bleibt verpflichtend.

**Remote-Bearbeitung freigeben** verlangt eine ausdrückliche Bestätigung: Speichern und Auto Save schreiben direkt auf den Server. Die Freigabe gilt nur für die ausgewählte Datei/Sitzung. Die Statusleiste zeigt den Zustand und ermöglicht Freigeben bzw. Sperren. Schließen/Neustart verwirft die Freigabe. Bei Konflikten bleiben Änderungen ungespeichert; Datei neu öffnen und Inhalte abgleichen.

```sh
# Laufende Fixtures und echte lokale VS-Code-Programmdatei vorausgesetzt:
export VSCODE_TEST_EXECUTABLE="/Applications/Visual Studio Code.app/Contents/MacOS/Code"
npm run test:editor
# Zusätzlich lokal installierte Remote-SSH 0.128.0 / Remote-SSH-Edit 0.87.0:
npm run test:editor:remote
```

Der Remote-Test verwendet die separate Debian-Fixture auf Port `22224` und ein isoliertes VS-Code-Profil. Lokales Fenster, echtes Remote-SSH-Fenster, Auto Save, Konflikte und Zugriff aus einer Remote-Workspace-Erweiterung sind geprüft. Der bislang offene technische M0-02-Remote-Nachweis ist damit ebenfalls abgeschlossen. Kein Push-Watching fremder Serveränderungen, keine großen Dateien, keine dauerhaften Editorsitzungen; die produktive Editorintegration ist seit M5 verfügbar. [Nachweis und Grenzen](docs/nachweise/M0-08.md).

## Abschluss M0 und weiterer Aufwand

[M0-09](docs/nachweise/M0-09.md) schließt alle neun technischen Nachweise ab. `ssh2` und beide Protokollwege bleiben gewählt; VS-Code-Untergrenze, Serverfähigkeiten, Paketstrategie und Ersatzwege sind verbindlich dokumentiert. Der damalige nächste Schritt war M1-01; inzwischen ist die [SFTP-Alpha aus M3](docs/nachweise/M3-Abschluss.md) abgeschlossen. Restaufwand M1–M6: 31–46 Personenarbeitstage, mit Reserve 38–56; [Begründung](docs/entscheidungen.md#d10--aufwand-und-übergang-in-m1). M0-Abschluss ist keine Freigabe der noch fehlenden Produktmodule oder der ungeprüften Plattformen.

## Qualitätsbefehle (M1-01)

`npm run quality` führt ESLint, automatische JavaScript-Syntaxprüfung, Unit-Tests, gerenderte React-DOM-Tests und beide Builds aus. Einzeln: `npm run lint`, `npm run check`, `npm run test:unit`, `npm run test:webview`, `npm run build`. Domain unter `src/domain` bleibt frei von Runtime-/UI-Bibliotheken; Application koordiniert injizierte Adapter, VS-Code-Integration liegt unter `src/vscode`. JSX bleibt JavaScript ohne TypeScript-Compiler.

## VSIX installieren

Node 22.13.1 oder neuer verwenden (`nvm use`). Die SSH-Fixtures werden für diese Demo nicht benötigt.

```sh
npm ci
npm run quality
npm run package
```

In VS Code Desktop ab 1.140.0: Erweiterungsansicht → Menü „…“ → „Aus VSIX installieren…“ → `out/FileTandem-0.0.8.vsix`. Dann die FileTandem-Activity-Bar öffnen oder **FileTandem: Dateimanager öffnen** über die Befehlspalette ausführen. Alternativ startet `npm start` den Entwicklungs-Host. Die aktuelle Commander-Ansicht liest das echte lokale Dateisystem und kann SFTP-Profile verbinden. Die ursprüngliche M1-Demo bleibt unter **FileTandem: Mock-Demo öffnen** verfügbar. Die SFTP-Transferknöpfe sind angebunden; [Alpha-Anleitung](docs/nachweise/M3-Alpha.md).

`npm run test:installed` installiert und testet die VSIX ausschließlich in einem temporären, anschließend entfernten Profil. Bei vorhandener VS-Code-Installation lässt sich `VSCODE_TEST_EXECUTABLE` auf die Programmdatei setzen; sonst wird die festgelegte Testversion geladen. Python 3 wird für die unabhängige ZIP-Prüfung benötigt.

Die GitHub-Actions-Datei führt Lint, Syntaxprüfung, Unit-/React-DOM-Tests, Build und Packaging auf Linux, macOS und Windows aus; Linux ergänzt einen installierten Extension-Host-Test unter Xvfb. Actions sind auf konkrete Revisionen fixiert ([Checkout](https://github.com/actions/checkout/releases), [Setup Node](https://github.com/actions/setup-node/releases)). Ohne Remote-Repository ist der gehostete Lauf offen. Native Restricted-Mode-, Theme-/Zoom- und Fensterneustart-Bedienabnahmen bleiben ebenfalls offen; siehe [M1-Abnahme](docs/nachweise/M1-Abschluss.md).

## Verbindungen und Dateiverwaltung (M2)

1. **FileTandem: Profil anlegen** wählen: Host, Port, Benutzer, Startordner, SFTP und Passwort/Key/Agent angeben. Ein leerer lokaler Startordner verwendet Home, auch ohne geöffnetes Projekt.
2. In der FileTandem-Activity-Bar ein Profil öffnen oder im Commander **Profil verbinden** wählen. Beim ersten Zugang den Host-Key unabhängig vergleichen und im nativen Dialog bestätigen. Passwort/Passphrase verlassen den Backend-/SecretStorage-Bereich nicht.
3. Pfad eingeben, Ordner öffnen oder Vor/Zurück/Übergeordnet verwenden. Beide Bereiche haben eigene Filter, Sortierung, versteckte Dateien, Spalten und Pfadfavoriten. Ctrl/Cmd und Shift ermöglichen Mehrfachauswahl.
4. **Neuer Ordner**, **Umbenennen**, **Löschen**, **Eigenschaften** und **Rechte** wirken auf den gewählten Bereich. Vorhandene Rename-Ziele werden abgewiesen. Lokales Löschen geht nach Bestätigung in den Papierkorb; Remote-Löschen ist bestätigt und endgültig. Symlink-Ziele werden bei rekursivem Löschen nicht traversiert.

Über das Profil-Kontextmenü lassen sich Profile bearbeiten, favorisieren, trennen und erneut verbinden. **FileTandem: Schnellverbindung** baut einen nicht gespeicherten Zugang auf. **FileTandem: Gespeicherte Anmeldung vergessen** entfernt ein gespeichertes Passwort/eine Passphrase. **FileTandem: Profile ohne Geheimnisse exportieren** öffnet ein JSON-Dokument mit Profilmetadaten.

SFTP-only benötigt weder Shell noch VS Code Server. Seit M4 bieten SCP-Profile ebenfalls Dateioperationen und Transfers über die explizite GNU/Linux-Shell-Anbindung. Windows-POSIX-chmod und lokale UNC-Authorities werden derzeit verständlich verweigert. Pro Ordner sind vorerst 10.000 Einträge vorgesehen; Remote-Löschpläne sind auf 10.000 Einträge und Tiefe 100 begrenzt. SFTP v3 erlaubt keine transaktionale Absicherung gegen gleichzeitige externe Pfadänderungen; Typ-/Elternprüfungen erkennen Änderungen zwischen Schritten.

```sh
# Nur eigene isolierte Fixtures:
npm run test:browser
VSCODE_TEST_EXECUTABLE="/Applications/Visual Studio Code.app/Contents/MacOS/Code" npm run test:browser:installed
```

Diese Tests benötigen laufende Fixtures (siehe oben). Der zweite Test installiert die gebaute VSIX in einem temporären Profil und startet zwei normale VS-Code-Fenster nacheinander, um echte Profil-/Host-Key-Persistenz zu prüfen. Eigene Testordner werden im nativen Papierkorb geprüft; alle temporären Profile werden entfernt. Es werden keine produktiven Server verwendet. [M2-Abschluss und Abnahmen](docs/nachweise/M2-Abschluss.md).

## SFTP-Alpha (M3)

Private VSIX: `out/FileTandem-0.0.8.vsix`. [Anleitung, Prüfergebnisse und Grenzen](docs/nachweise/M3-Alpha.md). Reproduzierbar: `npm run quality`, `npm run test:transfers` mit laufenden eigenen Fixtures, `npm run package`, `npm run test:browser:installed`. Der Installationstest verwendet zwei reguläre isolierte Fenster und prüft zusätzlich Upload nach Tab-Schließen, Ordner-Rundlauf sowie Journal und gezielten Retry nach Neustart.

## SCP und Wiederanlauf (M4)

Version 0.0.4 verbindet echtes SCP mit Commander und Queue. SFTP-Teil-Dateien können ausdrücklich nach Quellen-/Präfixprüfung fortgesetzt werden; SCP startet vollständig neu. Eigene Partials lassen sich bestätigt bereinigen. Profile unterstützen außerdem Agent und interaktive Serveranmeldung. [Bedienung und Grenzen](docs/nachweise/M4-Anleitung.md) · [Abschluss](docs/nachweise/M4-Abschluss.md).

Mit laufenden eigenen Fixtures prüft `npm run test:protocols` die gemeinsame Server-/Auth-/Transfermatrix. `npm run test:browser:installed` prüft die frische VSIX mit zwei regulären isolierten VS-Code-Starts, SFTP-only und SCP-only sowie SFTP-Fortsetzung nach Neustart.

## Editor und Komfort (M5)

Serverdateien im Commander doppelklicken oder mit Enter öffnen. SFTP startet schreibgeschützt; nach ausdrücklicher dateiweiser Freigabe schreiben Speichern und Auto Save auf den Server. Diff und geprüfte Basisübernahme helfen bei externen Änderungen. SCP verwendet lokale Kopien mit ausschließlich ausdrücklichem Queue-Upload. Weitere Tabs, internes Drag-and-drop, Kontextmenüs, optionale Commander-Tasten, virtualisierte 10.000 Einträge und Deutsch/Englisch sind verfügbar. [Anleitung und Grenzen](docs/nachweise/M5-Anleitung.md) · [Abschluss und Prüfergebnisse](docs/nachweise/M5-Abschluss.md).

## Produktname und Lizenz

Eigener Projektcode steht unter der [MIT-Lizenz](LICENSE); enthaltene Drittanbieter haben ihre [eigenen Hinweise](THIRD_PARTY_NOTICES.md). Produktname: **FileTandem**. Marketplace-Titel: **FileTandem – SFTP & SCP File Manager**. Die juristische Freigabe des Namens wurde am 08.10.2026 vom Benutzer bestätigt; Publisher `xscp-dev` bleibt ein Entwicklungsplatzhalter. Technische Kennungen `xscp.*` bleiben für bestehende Profile/Einstellungen erhalten. Die vorgezogene Namens-/Publisher-Klärung und vorbereiteten öffentlichen Texte stehen unter [Produktdaten](docs/produktdaten.md).
