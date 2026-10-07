# Kompatibilität und technische Freigaben

Stand: 7. Oktober 2026, Abschluss M0. Diese Matrix beschreibt **Prototypnachweise**, keine fertige Version 1.0. [Entscheidungen](entscheidungen.md) legen den weiteren Ausbau fest; [M0-Nachweise](meilensteine/M0.md) enthalten die einzelnen Prüfungen.

## Versionen und Laufzeiten

| Bestandteil | Fixierter / geprüfter Stand | Bedeutung |
| --- | --- | --- |
| VS Code Desktop | **1.140.0**, Manifest `^1.140.0` | Vollständig geprüfte Mindestversion; höhere Versionen müssen Regression bestehen |
| Entwicklungs-Node / npm | 22.13.1 / 10.9.2 | `.nvmrc`, `engines.node >=22.13.1`, `npm ci` |
| Tatsächlicher UI Extension Host | Node 24.21.0, Electron 43.7.3 | Laufzeit von VS Code; kein separates Anwender-Node nötig |
| Hostbundle | esbuild, Ziel Node 22, CommonJS | Nutzt keine Node-24-exklusiven APIs; kein Browser-Host |
| ssh2 | 1.17.0 | Gemeinsame SSH-Basis für beide Protokolle |
| React / React DOM | 19.3.0 / 19.3.0 | Gebündelte Webview, noch keine fertige Commander-Oberfläche |
| esbuild / test-electron | 0.28.2 / 3.1.0 | Entwicklungsabhängigkeiten |
| VS-Code-Typen | 1.138.0 | Entwicklungsunterstützung, keine Runtime-/Mindestversionszusage |
| vsce | 4.0.0 | Im Packaging-Script exakt angefordert; nicht Runtime-Bestandteil |
| Remote-SSH / Remote-SSH-Edit | 0.128.0 / 0.87.0 | Nur Abnahme des Remote-Arbeitsfensters, keine xScp-Transferabhängigkeit |
| Testserver | Debian 12, glibc 2.36, OpenSSH 9.2p1 | Linux arm64, Docker Engine 29.5.2, Colima 0.10.3; Image-Basis per Digest fixiert |

VS Code 1.139.1 bestand in M0-01 nur den Start-Smoke; 1.139.0 war eine vorläufige Manifestangabe. Beide werden nach M0-09 nicht als Produktbaseline angeboten. Die höhere Untergrenze ist eine konservative Abnahmeentscheidung, keine Behauptung, dass alle benutzten APIs erst seit 1.140 existieren. Manifest, Lockfile und Teststarter sind darauf abgestimmt.

## Desktop- und Fenster-Matrix

| Desktop / Fenster | Status nach M0 | Freigabe / nächste Prüfung |
| --- | --- | --- |
| macOS 26.6.2 / Darwin 25.6, Apple Silicon | Geprüft: Build, lokale Datei, Auth, SFTP/SCP, installierte VSIX | Grundlage für spätere macOS-Alpha; Produktmodule fehlen noch |
| macOS mit echtem Remote-SSH nach Linux arm64 | Geprüft: Desktop-Marker, erreichbarer Remote-Workspace, Editor, Auto Save, Cross-Host-Lesen | xScp bleibt lokal; [M0-08](nachweise/M0-08.md) |
| macOS Intel | Nicht geprüft | Eigener Plattformlauf vor Zusage |
| Linux Desktop | Nicht geprüft; Linux-Server beweist keinen Desktop | M6-02: Installation, Dateipfade, Rechte, Agent und Desktop-Host |
| Windows Desktop / OpenSSH-Agent | Nicht geprüft; Pipe-Syntax nur Unit-Test | M6-02/M4-07: echte Named-Pipe-Verbindung, Laufwerke/UNC/Namen |
| WSL / Dev Containers / Desktop-Codespaces | Nicht geprüft | Lokaler UI-Host vorgesehen; M6-02 vor Zusage |
| Browser / vscode.dev / Browser-Codespaces | Außerhalb 1.0 | Kein Browserbundle, kein Gateway |
| Restricted Mode | Im Manifest deaktiviert, zusätzlich Hostguards | Eigene Restricted-Mode-Bedienabnahme in M1-02/M6-01 |

Start ohne Workspace und tatsächlicher Extension-Host-Smoke sind vorhanden; native Dialogbedienung, Screenreader/High Contrast und vollständige Commander-Tastaturwege sind noch keine M0-Freigabe. Remote-Workspace-Dateien werden nicht zu lokalen Uploadquellen. Aktuell werden `file:`-URIs mit Authority/UNC für den lokalen Nachweis abgewiesen.

## Zielserver: Protokollfähigkeiten statt VS-Code-Serverpflicht

| Funktion | Erforderlich | Nachgewiesen / Grenzen |
| --- | --- | --- |
| SSH-Verbindung | Erreichbarer SSH-Endpunkt, unterstützte Auth/Kryptografie, bestätigter Host Key | OpenSSH 9.2p1 mit Ed25519-Hostkey; andere Implementierungen/Hostkeytypen nicht separat abgenommen |
| SFTP-Dateitransfer | SFTP-Subsystem mit benötigten Dateioperationen | SFTP und SFTP-only ohne Shell; kein Exec, GNU-Werkzeug oder VS Code Server nötig |
| Sicheres Editor-Ersetzen | SFTP, reguläre Datei ≤10 MiB, Schreiben im Elternordner, `posix-rename@openssh.com` | In OpenSSH-Fixtures einschließlich SFTP-only geprüft; ohne Rename-Erweiterung nur lesen/lokal bearbeiten und explizit in neues Ziel übertragen |
| Echtes SCP | Exec, POSIX-Shell, serverseitiges `scp`; keine SFTP-Abhängigkeit | Einzeltransfer auf Server mit deaktiviertem SFTP geprüft |
| SCP-Dateibrowser | Linux/POSIX/GNU-Profil, GNU find/coreutils, verwendetes grep | NUL-Metadaten und Quotierung geprüft; Capability-Probe wird M4-03 integrieren |
| SCP auf BSD/macOS/BusyBox/Windows-Ziel | Separates Shell-/Werkzeugprofil | Nicht zugesagt; falls vorhanden SFTP ausdrücklich wählen |
| VS-Code-Remote-Arbeitsfenster | Unabhängig von xScp: kompatibler VS Code Server und Remote-SSH | Nur für dieses Arbeitsfenster, nicht für die Verbindung zum Datei-Zielserver |

Die offiziellen [Remote-Linux-Voraussetzungen](https://code.visualstudio.com/docs/remote/linux) nennen unter anderem Kernel ≥4.18, glibc ≥2.28, libstdc++ mit GLIBCXX ≥3.4.25, tar und SSH/bash/curl oder wget. Sie betreffen den VS Code Server. Der frühere Testhost mit Ubuntu 18.04/glibc 2.27 scheiterte daran, obwohl SSH-Anmeldung möglich war. Daraus folgt **keine glibc-Untergrenze für den xScp-SFTP-Zielserver**. Andere Server werden anhand ihrer Protokollfähigkeiten bewertet; eine universelle Zusage für jeden SSH-Server wäre unbelegt.

Der Digest fixiert das Debian-Basisimage, nicht sämtliche anschließend per apt installierten Sicherheitsupdates. Reproduzierbar sind Fixture-Aufbau und Protokollgrenzen; bitidentische Neubauten werden nicht zugesagt. Image-ID und tatsächlich installierte Versionen werden im Prüflauf protokolliert; nach einem Neubau ist die Protokollmatrix erneut auszuführen.

Die zusätzliche Remote-Fixture erlaubt ausschließlich lokales TCP-Forwarding zu Loopback-Zielen. Die vier Protokoll-/Auth-Fixtures bleiben ohne Forwarding. Benutzer unprivilegiert, Ziele nur auf Desktop-Loopback veröffentlicht, generierte Keys/Passwörter ausschließlich disposable Testmaterial. [Fixture-Anleitung](../test/fixtures/ssh/README.md).

## Authentifizierung

| Verfahren | macOS → OpenSSH | Abgrenzung |
| --- | --- | --- |
| Passwort, Ed25519, RSA-3072 | Bestanden, auch frisch installierte VSIX | RSA funktioniert ohne Freigabe von RSA/SHA-1 |
| Verschlüsselte OpenSSH-Ed25519-/RSA-Keys | Bestanden, auch VSIX | Vollständige Anmeldedialoge/SecretStorage erst M2 |
| Separater Unix-Agent | Ed25519 und RSA bestanden; VSIX zusätzlich Ed25519 | Persönlicher Agent wird nicht automatisch verwendet |
| Keyboard-Interactive | Echtes PAM bestanden | Testpasswortprompt, keine MFA-/TOTP-/FIDO-Abnahme |
| Windows-OpenSSH-Named-Pipe | Offen | Keine erfolgreiche Windows-Agent-Verbindung behauptet |
| Pageant/Cygwin, Agent Forwarding, ProxyJump | Ausgeschlossen | Keine paketierten Helfer / nicht 1.0 |

[M0-07](nachweise/M0-07.md) beschreibt negative Fälle, Abort/Timeout und die vollständige Matrix. Keine automatische Freigabe alter Algorithmen zur Erhöhung vermeintlicher Kompatibilität.

## Aktuelle Grenzen und Release-Ziele

| Bereich | M0-Prototyp | Vor späterer Freigabe |
| --- | --- | --- |
| SFTP-Streaming | Gut 32 MiB bidirektional, 64-KiB-Puffer, Hashes/Abort; neue Ziele exklusiv | Queue, Rekursion, atomare Finalisierung, Journal: M3 |
| SCP-Streaming | Einzeldatei höchstens 1 GiB; Header 4096 Bytes, Verzeichnisliste 1 MiB | Grenzen vor M6-04 gezielt erhöhen; Parser-/Listenressourcen begrenzen, >4-GiB-Test |
| Zielkollision | M0-Transfers ersetzen keine bestehenden Ziele; eigene Partials können bleiben | Entscheidungen und sichere Temp-/Rename-Pipeline: M3-03/04, M4-02/04 |
| Resume | Nicht implementiert | SFTP-Präfixvergleich M4-05; SCP startet Einzeldatei neu |
| Editor | Nur SFTP, vorhandene reguläre Datei ≤10 MiB, Sitzung nicht persistent | Konflikt/Diff/Monitoring/Metadatenstrategie M5; große oder SCP-Dateien als lokale Kopie bearbeiten und bewusst hochladen |
| Parallelität / Leistung | Einmalige Probes; keine Gesamt-RSS-/RTT-Messung | Zwei Transfers pro Server als Startwert, <128 MiB zusätzlicher RSS bei 4 GiB als Messziel, keine Zusage |
| VSIX | Tatsächliche Installation/Aktivierung/Auth ohne native Addons bestanden | M6: Produktoberfläche, Matrix, Lizenz/Metadaten und vollständige Abnahme |

SCP-Editorweg für 1.0: lokal herunterladen, native lokale Datei bearbeiten und explizit über die Transferqueue zurückladen. Auto Save der lokalen Kopie löst **keinen SCP-Upload** aus. Dadurch bleibt SCP-Bearbeitung möglich, ohne einen unbewiesenen automatischen Remote-Speicherweg anzubieten. M5-08 prüft beide Protokollwege mit dieser unterschiedlichen Semantik.

## Risiken, Nachweise und Ersatzwege

Jede M0-Unsicherheit hat einen Nachweis oder einen konkreten begrenzten Ersatzweg. Offene Produktprüfungen behalten ihr späteres Release-Gate; M0-Abschluss erklärt sie nicht für bestanden.

| Risiko | Nachweis / aktueller Befund | Festgelegter Ersatz oder Gate |
| --- | --- | --- |
| Falscher Extension Host | M0-02/08: Desktop-Marker und anderer Workspace-Host | Lokal installieren; Hostoverride abweisen; keine Remote-Datei als lokale Quelle |
| Nicht kompatibler VS Code Server | Remote-Fixture besteht; früherer Server scheitert | Normales Desktopfenster mit direktem SFTP/SCP; kein Serverupgrade durch xScp |
| Ungeprüfter/geänderter Host Key | M0-04: Ablehnung und Rotation | Verbindung blockieren, unabhängige Prüfung und bewusster M2-Trust-Workflow |
| Shell/SFTP fehlt | M0-03/05/06 trennen beide Fähigkeiten | Betroffene Funktion ablehnen; expliziter Protokollwechsel nur wenn verfügbar |
| SCP-Parser/Quotierung | M0-06: ACK/Größen/Namen/Quotes/Abort | M4-01/03/08 harte Negativ-/Fuzzing-Gates; alternativ expliziter CLI-Adapter mit neuer Abnahme |
| Nicht passende SCP-Werkzeuge/Namen | GNU-Profil und ausgeschlossene Namen dokumentiert | Capability-Probe; SFTP anbieten; niemals unsicher quotieren |
| Fehlendes atomares Ersetzen | M0-08: OpenSSH-Rename besteht | Original erhalten; nur neues Ziel oder Download/lokale Kopie; M3-03 |
| Fremde Änderungen / Metadatenerhaltung | M0-08: Konflikt hält dirty; CAS/ACLs nicht bewiesen | M5-03 Warnung/Diff; kein stilles Ersetzen bei Konflikt oder erforderlichen nicht erhaltenen Metadaten |
| Auto Save ohne Freigabe | M0-08: Backend sperrt auch programmgesteuerte Edits | Nur dateiweise Freigabe; lokale SCP-Kopie ohne automatischen Upload |
| Cross-Host-Provider | M0-08: echte Remote-Erweiterung liest lokalen Provider | Andere Kombinationen M6-02; bei Fehler Editor dort sperren, Download/lokale Kopie |
| Windows-/Linux-Desktop und Agent | M0-07: Testsysteme fehlen | Plattformrelease bis M6-02 offen; Agent ggf. ausblenden, Passwort/Key separat prüfen |
| Native Addons / Paketgeheimnisse | M0-07/08: frische VSIX und Inhaltsprüfung | Universalbundle ohne Addons; M6-05 Gate; native Paketmatrix nur nach Performancebeleg |
| Große Dateien / Listen / langsame Verbindung | 32-MiB-Protokollnachweis, keine Performanceabnahme | M6-04, SCP-Grenzanhebung M4; bis dahin Prototype-Limits offen anzeigen |
| Netzabbruch / Reload / Resume | Protokoll-Abbruch geprüft; Queue/Journal fehlen | M3-07/08, M4-05/06; kein automatisches Fortsetzen/Überschreiben |
| Symlinks / Windows-Namen / Rechte | Editor lehnt Symlinks ab, plattformweite Matrix fehlt | Rekursion überspringt Symlinks; M3-05/M6-02/03, keine Pfadnormalisierung mit Datenverlust |
| Webview, Secrets, Restricted Mode | CSP/Hostguards vorhanden; produktive Nachrichten/Profile fehlen | M1-02/03, M2-02, M6-05; native Passwortdialoge, keine Webview-Secrets |
| Fremde Serveränderungen ohne Watch | Kein SFTP-Push; nur eigene Events | Begrenztes Polling/Diff M5-04; kein Echtzeitversprechen |
| Dependency-Schwachstellen | `npm audit` vollständig und `--omit=dev`: jeweils 0 gemeldet am 7.10.2026 | Regelmäßige Audit-/Updateprüfung, M6-05; Momentaufnahme ist kein Sicherheitsbeweis |
| Fehlende native Dialog-/Accessibility-Abnahme | Automatisierte API-Adaptertests vorhanden | M1-05/M5-07/08; kein behaupteter manueller UI-Erfolg |
| Eigene Lizenz/Publisher/öffentliche Registry | Private VSIX funktioniert; MIT als Lizenzrichtung entschieden | M6-08 setzt Lizenzdatei/Produktdaten um; Publikation nur eigener M6-09-Auftrag |

## Reproduzierbarkeit und nächste Freigabe

`npm ci`, `npm run check`, `npm test`; bei laufenden eigenen Fixtures zusätzlich Host-Key-, Auth-, SFTP-, SCP-, Editor- und Packaging-Befehle aus den Nachweisen. Mindestversion und jeweils geprüftes neues Stable laufen künftig in M6-01/CI. Remote-SSH wird ausschließlich für den echten Fenster-Test benötigt, Docker/OpenSSH-CLI nur für Entwicklung/Abnahme.

M0-09 prüft Manifest/Lockfile/Testbaseline, Dokumentationslinks und vollständige M0-Checkboxen. Es startet keine Tests gegen fremde Server und kein öffentliches Release. [Abschlussprotokoll](nachweise/M0-09.md).

## M5: Editor und Bedienung

Private VSIX 0.0.5 auf macOS arm64/VS Code 1.140.0: Produktions-SFTP-Provider und Auto Save lokal sowie in echtem Remote-SSH-Fenster geprüft; entfernte Workspace-Erweiterung liest den lokalen UI-Provider. SCP-only bearbeitet lokale Kopien und lädt nur auf ausdrücklichen Queue-Auftrag hoch. 10.000 reale Einträge sind bei Dark/High Contrast/High Contrast Light und Zoom 0/2/1 virtualisiert nachgewiesen. Deutsch/Englisch für Manifest/React/native Dialoge geprüft. Windows/Linux-Desktop und vollständige manuelle Screenreader-Abnahme bleiben M6 offen. [Abschluss/Grenzen](nachweise/M5-Abschluss.md).
