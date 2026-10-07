# Technische Entscheidungen nach M0

Stand: 7. Oktober 2026. Gültig für M1–M6. **M0 ist technisch abgeschlossen; M1 kann beginnen.** Die Entscheidungen beruhen auf den [M0-Nachweisen](meilensteine/M0.md) und den jeweils verlinkten Primärquellen. Vor- und Nachteile sowie Aufwand sind unsere Bewertung, keine Leistungszusage der Bibliothekshersteller. [Kompatibilität](kompatibilitaet.md) trennt geprüfte Eigenschaften von Release-Zielen.

## D01 – Desktop und lokaler UI Extension Host

Festlegung: `extensionKind: ["ui"]`, Node-Einstieg `main`, kein Browser-Einstieg. Links bleibt das Desktop-Dateisystem, auch im Remote-Fenster. Desktop-Node verarbeitet lokale Dateien und Agenten; Remote-Workspace-URIs werden nicht als lokale Pfade interpretiert. Ein Wechsel des Hosts per Benutzereinstellung wird abgewiesen.

| Weg | Vorteile | Nachteile / Entscheidung |
| --- | --- | --- |
| Lokaler UI-Host | Lokale Dateien und Agenten, keine zusätzliche Serverinstallation für xScp | Remote-Workspace-Dateien sind keine lokalen Uploadquellen; gewählt |
| Workspace-Host | Direkter Zugriff auf Workspace-Umgebung | Linke Dateiquelle/Agent wären remote; verworfen |
| Browser mit Gateway | Nutzung in vscode.dev denkbar | Zusätzlicher Dienst und anderes Vertrauensmodell; außerhalb 1.0 |

Die Host-Zuordnung folgt dem [VS-Code-Extension-Host-Modell](https://code.visualstudio.com/api/advanced-topics/extension-host). Tatsächlicher lokaler Dateizugriff im Remote-Fenster und Cross-Host-Provider-Zugriff: [M0-02](nachweise/M0-02.md), [M0-08](nachweise/M0-08.md).

## D02 – JavaScript, React und zwei esbuild-Bundles

Festlegung: ES-Module in `.js`/`.jsx`, JSDoc und `jsconfig`, React für die Commander-Webview, esbuild für ein CommonJS-Hostbundle und ein Browserbundle. `vscode` bleibt external. Kein Monorepo, kein TypeScript-Compiler, keine neue UI-Bibliothek. ESLint und Nachrichtenvalidierung folgen in M1.

| Alternative | Vorteil | Nachteil / Entscheidung |
| --- | --- | --- |
| React | Komponenten und expliziter UI-Zustand passen zu Auswahl, Tabellen und Queue | Mehr Bundle-/Renderaufwand; gewählt, Virtualisierung wird separat geprüft |
| Direkte DOM-Manipulation | Kleine initiale Oberfläche | Mehr eigene Zustands-/Lifecycle-Koordination; verworfen |
| TypeScript | Zusätzliche statische Prüfung | Neue Build-/Migrationsarbeit und Abweichung von JavaScript-Vorgabe; verworfen |
| Webpack / ungebündelte Module | Bewährte Pluginmöglichkeiten / einfache Quellen | Mehr Konfiguration bzw. mehr Runtime-Dateien; für diesen Umfang unnötig |

Die [React-Komponenten-/Zustandsstruktur](https://react.dev/learn/thinking-in-react) und [VS-Code-Bundling-Anleitung](https://code.visualstudio.com/api/working-with-extensions/bundling-extension) stützen den Aufbau. Ein WebviewPanel trägt die Commander-Ansicht; native TreeView/Dialoge bleiben für Profile und Entscheidungen. Die eigene Webview verlangt zusätzliche Theme-, Fokus- und Accessibility-Arbeit gemäß [Webview-UX](https://code.visualstudio.com/api/ux-guidelines/webviews). M0 beweist Start und Hostaktivierung, noch keine produktive Nachrichten-/Dateilistenabnahme.

## D03 – Gemeinsame SSH-Basis: ssh2 1.17.0

Festlegung: Alle Verbindungen gehen durch `connectSsh`; darüber liegen getrennte SFTP-/SCP-Adapter. SSH/Kryptografie werden nicht selbst gebaut. Abhängigkeiten bleiben exakt fixiert und werden über `npm ci` installiert.

| Kandidat | Vorteile | Nachteile / Entscheidung |
| --- | --- | --- |
| ssh2 direkt | Eine Verbindungspolitik für SFTP, Exec, Keys, Agent und Keyboard-Interactive | Callback-/Event-Cleanup selbst lösen; gewählt, M0-04 bis M0-08 belegen den Weg |
| ssh2-sftp-client | Promise-API und fertige SFTP-Komfortoperationen | Zusätzliche Abstraktion über derselben SSH-Basis; SCP benötigt weiter einen eigenen Exec-Weg; verworfen |
| Lokales OpenSSH-CLI | Vorhandene SSH-Konfiguration und zusätzliche Agentverfahren nutzbar | Externe Installation, Prozess-/Promptabbruch, plattformabhängige Konfiguration und zweiter Trust-Weg; nur explizite Ersatzarchitektur |
| Native SSH-Bibliothek | Potenzieller Geschwindigkeitsvorteil | Binärpakete je Plattform/Architektur und zusätzliche Builds; ohne Performancebeleg verworfen |

Funktionen und optionale Beschleunigung: [ssh2 1.17.0](https://raw.githubusercontent.com/mscdex/ssh2/v1.17.0/README.md). Der [SFTP-Wrapper](https://github.com/theophilusx/ssh2-sftp-client) dokumentiert seine zusätzliche Promise-/Event-Schicht. Unsere Entscheidung bevorzugt kontrollierbare Lebensdauer und ein gemeinsames Sicherheitsmodell; sie behauptet keinen Geschwindigkeitsvergleich.

## D04 – Host Keys und Authentifizierung

Festlegung: Unbekannte Schlüssel nur nach expliziter Bestätigung des SHA-256-Fingerprints; geänderte Schlüssel blockieren. Host **und Port** bilden die Identität. Trust lokal und getrennt von Geheimnissen speichern, nicht synchronisieren. Kein ungeprüfter Verbindungsweg, kein automatischer Algorithmus-Downgrade, kein Agent Forwarding. Das ist erforderlich, weil ssh2 ohne eigenen Verifier automatisch akzeptiert; die Factory verhindert diese Voreinstellung. [ssh2-Verifier](https://raw.githubusercontent.com/mscdex/ssh2/v1.17.0/README.md), [M0-04](nachweise/M0-04.md).

TOFU ist einfach bedienbar, verlangt aber beim Erstkontakt einen unabhängigen Fingerprintvergleich. Eine gemeinsame Benutzer-`known_hosts`-Integration hätte zentrale Verwaltung, erfordert jedoch zusätzlich Parser-/Wildcard-/Hashed-Host-Semantik; für 1.0 wird der eigene Trust-Speicher gewählt. Bewusste Vertrauensänderung erhält einen separaten Workflow in M2.

Passwort, Ed25519/RSA-SHA-2, verschlüsselte OpenSSH-Keys, Unix-Agent und explizites Keyboard-Interactive bleiben Zielumfang. Keine Antwort aus einem gespeicherten Passwort erraten. Windows: OpenSSH-Named-Pipe erst nach echtem Plattformtest; solange Passwort/Key als Ersatzweg, ebenfalls vor Windows-Auslieferung prüfen. Pageant/Cygwin werden ausgeschlossen. MFA/Hardware-Token werden ohne Nachweis nicht zugesagt. Vorteile: keine externen Helfer und einheitlicher Trust; Kosten: kein vollständiges `~/.ssh/config`-/ProxyJump-Verhalten. [M0-07](nachweise/M0-07.md).

## D05 – SFTP als Standard, echtes SCP explizit

SFTP arbeitet ohne Shell und ist deshalb der allgemeinere Dateimanagerweg. Streams mit Backpressure bleiben für große Dateien vom Editor getrennt; 64 KiB sind der geprüfte Pufferstartwert. Keine komplette Datei als Buffer oder Webview-Nachricht übertragen. Die [SFTP-API](https://github.com/mscdex/ssh2/blob/v1.17.0/SFTP.md) liefert Streams/Positionszugriff; [M0-05](nachweise/M0-05.md) bestätigt Hashes und Abbruch auch ohne Exec.

SCP bleibt verpflichtender Bestandteil von 1.0: eigener begrenzter Sender/Empfänger über `scp -t`/`scp -f` und SSH-Exec, GNU-find-NUL-Metadaten statt formatiertem `ls`. Gewählt ist das geprüfte Linux/POSIX/GNU-Serverprofil. Rekursion erfolgt im Client; keine Wildcards. Vorteil: echter SCP-Weg auch ohne SFTP. Nachteil: Parserwartung, Shell-/Werkzeugabhängigkeit und eingeschränkte Namen. OpenSSHs `scp` verwendet standardmäßig SFTP; `-O` dient nur dem unabhängigen echten SCP-Test. [OpenSSH scp](https://man.openbsd.org/scp), [M0-06](nachweise/M0-06.md).

Kein stiller Protokollwechsel. Fehlende Fähigkeiten deaktivieren die betroffene Funktion mit konkreter Ursache; bei vorhandenen SFTP-Fähigkeiten kann der Benutzer SFTP wählen. Scheitert die Parserhärtung in M4, wird ein ausdrücklich gewählter OpenSSH-`-O`-Prozessadapter evaluiert, einschließlich eigener Auth-/Trust-/Packaging-Abnahme. SCP entfällt dadurch nicht aus 1.0.

## D06 – Begrenzter Editor und sichere Finalisierung

Festlegung: bestehende reguläre SFTP-Dateien bis 10 MiB; initial Readonly plus Backend-Sperre. Freigabe je Datei/Sitzung mit nativer Warnung über Speichern und Auto Save. Zufällige Sitzungs-ID in der URI, keine Zugangsdaten. Cross-Host-Zugriff wird genutzt, solange der konkrete Hosttest besteht. Keine global persistente Schreibfreigabe. SCP-Dateien werden in 1.0 lokal heruntergeladen und nach Bearbeitung ausdrücklich über die Queue hochgeladen; Auto Save der lokalen Kopie schreibt nicht auf den SCP-Server.

| Weg | Vorteil | Nachteil / Entscheidung |
| --- | --- | --- |
| FileSystemProvider | Normales Speichern, Auto Save und VS-Code-Diff integrierbar | Vollständiger Inhalt im Speicher, Watch-/Konfliktsemantik selbst lösen; gewählt |
| Immer lokale Kopie und expliziter Upload | Einfacher, klare Uploadaktion | Zwei getrennte Inhaltsstände; Ersatzweg für große Dateien/fehlendes sicheres Rename |
| Automatisch editierbar / generischer Upload-on-save | Weniger Klicks | Unbeabsichtigte Serveränderungen; verworfen |

SHA-256-Referenzvergleich und temporäre Datei vor Rename bleiben verpflichtend. `posix-rename@openssh.com` liefert die verwendete POSIX-Ersetzung; fehlt sie, bleibt Editor-Schreiben gesperrt bzw. scheitert sicher. M3/M5 bieten stattdessen ein neues Ziel und expliziten Transfer an. Keine vorsorgliche Löschung des Originals. [OpenSSH-Protokoll](https://raw.githubusercontent.com/openssh/openssh-portable/master/PROTOCOL), [M0-08](nachweise/M0-08.md).

Restrisiko: Prüfung plus Rename ist kein Compare-and-Swap. Inode-Ersetzung erhält derzeit keine ACLs/xattrs/Besitzer/Hardlinks; fsync-Dauerhaftigkeit ist nicht bewiesen. M5 muss diese Grenzen vor Freigabe anzeigen und bei erforderlicher Metadatenerhaltung einen lokalen Kopier-/Uploadweg anbieten. Es gibt keinen universellen SFTP-Push-Watcher; später begrenztes Polling, jetzt nur eigene Änderungsereignisse.

## D07 – Daten, Trust und API-Grenzen

Profile/Referenzen in globalem Extension-Speicher, Geheimnisse künftig ausschließlich in VS-Code-SecretStorage, Schlüssel als lokale Pfade. Aktuell persistiert nur Host-Key-Vertrauen; vollständige Profile/SecretStorage sind M2-Arbeit. Keine Geheimnisse oder generischen Shellkommandos an die Webview. CSP, lokale Assets und erneute Hostvalidierung jeder Nachricht bleiben Pflicht. Kein Telemetrieversand in 1.0.

Restricted Mode deaktiviert die Extension; Verbindungen und Dateiänderungen werden zusätzlich im Host bewacht. Vorteil: klare Vertrauensgrenze; Nachteil: Nutzung erfordert einen vertrauenswürdigen Kontext. Der alternative Weg „nur einzelne Funktionen in Restricted Mode zulassen“ würde eine zusätzliche Berechtigungsoberfläche erfordern und wird zunächst verworfen. [Workspace Trust](https://code.visualstudio.com/api/extension-guides/workspace-trust).

## D08 – Versionen, Plattformen und Paket

VS-Code-Untergrenze **1.140.0**: Diese Version trägt die vollständige M0-Matrix einschließlich Remote-Editor und frischer VSIX. Keine Rückwärtszusage für 1.139.x aus dem früheren Start-Smoke. `engines.vscode = ^1.140.0`; Tests laden standardmäßig genau 1.140.0. Der Preis ist eine höhere Installationshürde; Vorteil ist eine belegte Baseline. Neuere Versionen werden in M6/CI zusätzlich geprüft. [VS-Code-Kompatibilitätsmanifest](https://code.visualstudio.com/api/working-with-extensions/publishing-extension).

Versionen bleiben wie geprüft, nicht automatisch auf den neuesten Stand gehoben. `@types/vscode` 1.138.0 ist ausschließlich eine konservative Entwicklungsbeschreibung stabiler APIs, keine Aussage über unterstützte VS-Code-Versionen. JavaScript wird auf Node 22 gebündelt; tatsächlicher Host Node 24.21.0 ist geprüft. Anwender brauchen kein separates Node/npm/OpenSSH für den normalen Transferweg.

Eine universelle VSIX ohne native SSH-Pflichtmodule wird beibehalten. Entwicklungs-`node_modules` können optionale Addons enthalten; im Runtime-Paket sind sie ausgeschlossen. Langsame Pure-JS-Performance wird zuerst gemessen; native Plattformpakete nur bei nachgewiesener Notwendigkeit. Private VSIX zuerst; kein automatisches Publish. xScp / `xscp-dev.xscp` bleibt Entwicklungsidentität, kein behauptetes Marketplace-Konto. Eigene Lizenzentscheidung für die spätere Auslieferung: MIT, ergänzt um bestehende Drittanbieterhinweise; Lizenzdatei/Release-Metadaten folgen in M6. MIT erlaubt breite Weiterverwendung bei Erhalt der Hinweise, erzwingt keine Veröffentlichung abgeleiteter Änderungen. [MIT-Lizenzbedingungen](https://opensource.org/license/mit).

## D09 – Tests und Release-Grenzen

M0 bleibt bei `node:test`, realen OpenSSH-Fixtures und `@vscode/test-electron`; kein Mocha-/Test-CLI-Zwang zusätzlich. Native Dialoge nutzen testbare Adapter; automatisierte Callbacktests ersetzen keine manuelle Dialog-/Accessibility-Abnahme. Fünf isolierte, eigene Loopback-Fixtures bilden Protokoll-, Auth- und echten Remote-SSH-Test ab. Kein Test gegen produktive Daten.

Releaseziel: macOS, Windows und Linux Desktop. Geprüfte Alpha-Basis: macOS arm64. Windows-/Linux-Desktop und Windows-Agent sind konkrete M6-Gates, kein M0-Blocker, weil M0-07 gerade ihre offene Matrix verlangt. Für Pageant gibt es Passwort/Key statt Helfer; für Browser keine 1.0-Auslieferung. Die vollständige Risiko-/Ersatzmatrix steht in [Kompatibilität](kompatibilitaet.md#risiken-nachweise-und-ersatzwege).

## D10 – Aufwand und Übergang in M1

M0 hat beide Protokollwege, Auth, Packaging und Remote-Editor belegt; diese Prototypen werden übernommen. Die größte verbleibende Unsicherheit liegt in rekursiven Transfers/Finalisierung/Journal, SCP-Härtung, plattformübergreifenden Dateipfaden und Accessibility. Deshalb sinkt der Gesamtaufwand trotz früher Prototypen nicht pauschal.

| Phase | Frühere Schätzung | Verbleibend nach M0 | Begründung |
| --- | ---: | ---: | --- |
| M0 | 4–6 Tage | 0 | Abgenommen; ursprüngliche Planung, keine gemessene Zeiterfassung |
| M1 | 3–5 | 3–5 | Build/Packaging übernehmen, Commander/CI/Validierung bleiben |
| M2 | 4–6 | 4–6 | Gemeinsame SSH-Factory steht; Profile/SecretStorage/CRUD fehlen |
| M3 | 6–9 | 7–10 | Atomare Ziele, Rekursion, Konflikte und Journal tragen Zusatzrisiko |
| M4 | 5–8 | 6–9 | Parser steht; Fuzzing, Capability-Probes und Wiederanlauf bleiben |
| M5 | 4–6 | 5–7 | Provider steht; Metadatenkonflikte, Diff und Accessibility fehlen |
| M6 | 5–8 | 6–9 | Windows/Linux/Agent plus große Dateien und Fehlermatrix |

**Restaufwand M1–M6: 31–46 Personenarbeitstage; mit 20 % Reserve aufgerundet 38–56 Tage, etwa 8–12 Vollzeitwochen.** SFTP-Alpha ab jetzt: M1–M3 = 14–21 Tage, mit Reserve 17–26. Vergleichbarer Gesamtrahmen einschließlich des ursprünglichen M0-Budgets: 35–52 Tage, mit Reserve 42–63; keine Behauptung tatsächlicher M0-Arbeitszeit. Eine Person, unveränderter Scope und verfügbare Testsysteme vorausgesetzt; Wartezeiten für Hardware/CI sind nicht enthalten.

M1 beginnt mit M1-01. Zuerst bestehende Adapter in die vorgesehene Schichtung übernehmen, Qualitätsbefehle ergänzen und anschließend Manifest/Commander bauen. Keine weitere technische Grundsatzentscheidung muss vorher vom Benutzer eingeholt werden. Öffentliche Konten und Veröffentlichung bleiben spätere externe Voraussetzungen; der Meilenstein autorisiert kein Publish.
