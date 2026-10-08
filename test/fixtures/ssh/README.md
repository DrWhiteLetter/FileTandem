# Isolierte SSH-Testumgebungen

M0-03 stellt drei lokale OpenSSH-Protokoll-Container bereit; M0-07 ergänzt eine separate Authentifizierungs-Fixture. Sie sind Testmaterial für xScp und benötigen keinen VS Code Server. Alle Zugänge sind ausschließlich auf `127.0.0.1` veröffentlicht.

| Alias in generierter SSH-Konfiguration | Port | SFTP | Shell / Exec | Echtes SCP |
| --- | ---: | --- | --- | --- |
| `xscp-fixture-sftp` | 22220 | Ja | Ja | Möglich |
| `xscp-fixture-sftp-only` | 22221 | Ja | Durch `ForceCommand internal-sftp` blockiert | Blockiert |
| `xscp-fixture-scp` | 22222 | Kein SFTP-Subsystem | Ja, GNU find/coreutils | Ja, `scp -O` |
| `xscp-fixture-auth` (M0-07) | 22223 | Ja | Ja | Möglich |
| `xscp-fixture-remote` (M0-08) | 22224 | Ja | Ja, begrenztes lokales TCP-Forwarding | Möglich |

Benutzer: `fixture`. Die drei Protokoll-Fixtures erlauben ausschließlich den lokal generierten Ed25519-Testschlüssel. Nur die Auth-Fixture erlaubt zusätzlich Passwort, RSA/verschlüsselte Testkeys und Keyboard-Interactive über PAM. Datenbereich: `/data`; jeder Start erzeugt frische Container und verwirft zuvor dort geschriebene Testdaten. Der SFTP-Startordner ist `/data`. Der Shell-Login startet im Home-Verzeichnis; für Shell-/SCP-Tests absolute `/data/...`-Pfade benutzen.

## Voraussetzungen

Node.js gemäß Projekt-README, Docker-CLI mit laufendem **lokalem Linux-Docker-Daemon**, OpenSSH-Clients `ssh`, `sftp`, `scp`, `ssh-keygen`, `ssh-agent`, `ssh-add` sowie OpenSSL mit `passwd -6 -stdin`. Host-Ports 22220–22224 müssen frei sein. Image-Build benötigt Netzwerkzugriff für Debian-Pakete; laufende Testcontainer verwenden ein eigenes Docker-Bridge-Netzwerk. Eingehende SSH-Zugriffe sind auf die veröffentlichten Loopback-Ports begrenzt; ausgehender Netzwerkzugriff ist durch Docker nicht gesperrt.

Auf macOS kann Colima den Docker-Daemon bereitstellen:

```sh
brew install --formula colima docker
# Vom Repository-Root: nur den Fixture-Ordner in die separate VM einbinden.
colima start xscp --vm-type vz --cpu 2 --memory 2 --disk 10 --root-disk 10 \
  --mount "$PWD/test/fixtures/ssh" --activate=false
export XSCP_DOCKER_CONTEXT=colima-xscp
```

Der Standard-Docker-Kontext wird hierbei nicht gewechselt. Eine andere vorhandene lokale Docker-Laufzeit ist ebenfalls möglich; `XSCP_DOCKER_CONTEXT` dann weglassen oder passend setzen. Docker Desktop kann eine Dateifreigabe des Fixture-Ordners benötigen. Windows wurde noch nicht geprüft; Linux-Docker und macOS/Apple Silicon sind die vorgesehenen Entwicklungsumgebungen.

## Start, Prüfung und Stop

Im Repository-Root:

```sh
npm run fixtures:start   # erzeugt Keys, baut Image und wartet auf alle fünf Zugänge
npm run fixtures:verify  # prüft Protokollgrenzen, Transfers und falschen Client-Key
npm run fixtures:status
npm run fixtures:stop    # entfernt nur Container/Netzwerk dieses Checkouts
```

`fixtures:start` kann erneut ausgeführt werden: vorhandene eigene Container werden neu erstellt, Testdaten gehen verloren, die Testschlüssel bleiben stabil. Container-/Netzwerknamen enthalten einen Hash des Checkout-Pfads; Ownership-Labels verhindern das Entfernen fremder Objekte. Bei Startfehlern werden eigene teilweise gestartete Container wieder entfernt. Andere Projekte müssen eigene Ports verwenden, zum Beispiel `XSCP_SSH_PORT_BASE=22320`; diese Einstellung für Start/Prüfung konsistent verwenden.

Nach Abschluss bei Colima zusätzlich `colima stop xscp` ausführen. Die VM und das gebaute Image bleiben für einen schnelleren nächsten Start vorhanden. Kein Autostart-Dienst wird eingerichtet.

```sh
npm run fixtures:init   # optional: nur Schlüssel und SSH-Konfiguration erzeugen
npm run fixtures:reset  # entfernt eigene Container/Netzwerk UND generierte Testschlüssel
```

`reset` verwirft ausschließlich das generierte `.runtime`-Verzeichnis. Beim nächsten Start entstehen neue Host Keys und eine neue passende Test-Trust-Datei.

## Zugänge und Host-Key-Prüfung

Generierte Dateien liegen unter `test/fixtures/ssh/.runtime/`:

- `client_ed25519`: unverschlüsselter, ausschließlich für die disposable Fixtures erzeugter Testkey; Modus 0600.
- `servers/<variante>/host_ed25519`: ein eigener Host Key pro Variante; keine gemeinsamen Hostidentitäten.
- `servers/<variante>/authorized_keys`: ausschließlich öffentliche Testclient-Keys; bei Auth zusätzlich die drei M0-07-Keys.
- `auth/credentials.json`: zufälliges disposable Testpasswort und Passphrase, Modus 0600; niemals protokollieren oder weitergeben.
- `auth/encrypted_ed25519`, `auth/client_rsa`, `auth/encrypted_rsa`: ausschließlich Testmaterial, OpenSSH-Format, RSA 3072 Bit. Verschlüsselte Keys verwenden die Testpassphrase aus `credentials.json`.
- `servers/auth/password_hash`: gesalzener SHA-512-Testpassworthash für `chpasswd -e`; nur dieser Hash, Hostkey und öffentliche Authorized Keys werden in die Auth-Fixture eingebunden. Private Clientkeys und Klartextpasswortdatei bleiben außerhalb des Containers.
- `packaging.json`: M0-07-Ergebnis nach erfolgreichem VSIX-Test; keine Zugangsdaten.
- `known_hosts`: unmittelbar aus den selbst erzeugten Host Public Keys aufgebaut; kein ungeprüftes `ssh-keyscan`-Vertrauen.
- `ssh_config`: feste Loopback-Ziele, Testidentität und `StrictHostKeyChecking yes`; keine persönlichen SSH-Konfigurationsdateien oder Agent-Schlüssel nötig.
- `verification.json`: Ergebnis und tatsächlich verwendete Versionen nach erfolgreicher Prüfung.

```sh
ssh-keygen -lf test/fixtures/ssh/.runtime/servers/sftp/host_ed25519.pub
ssh -F test/fixtures/ssh/.runtime/ssh_config xscp-fixture-sftp 'ls -la /data'
sftp -F test/fixtures/ssh/.runtime/ssh_config xscp-fixture-sftp-only
# Echtes SCP explizit erzwingen; heutiges OpenSSH scp verwendet sonst SFTP:
scp -O -F test/fixtures/ssh/.runtime/ssh_config ./README.md \
  xscp-fixture-scp:/data/readme-probe.md
```

Die App-Host-Key-Prüfung ist in M0-04 implementiert; `npm run test:host-keys` nutzt diese Fixtures für echte Key-Wechsel. Die Container-Konfiguration wird auch beim Daemon-Neustart aus der unveränderten Basis neu erstellt. Hier prüfen OpenSSH-Clients die kontrollierten Fixture-Hostidentitäten. Testkeys nie für andere Server verwenden. Die privaten Client-Keys werden nicht in das Container-Image oder in Servercontainer kopiert; nur der jeweilige Host-Key und öffentliche Authorized Keys sowie bei Auth der Testpassworthash werden read-only eingebunden.

## Was `fixtures:verify` nachweist

1. Alle fünf Container laufen und sind mit dem richtigen Testkey erreichbar.
2. SFTP, SFTP-only und Auth (mit Public-Key): kleine Datei hoch-/herunterladen, bytegleich vergleichen, Remote-Probe entfernen.
3. SFTP-only: Shell-Marker wird nicht ausgeführt und Legacy-SCP wird abgewiesen.
4. SCP: SFTP-Subsystem ausdrücklich abgewiesen; Upload und Download mit `scp -O` bytegleich; GNU find/coreutils vorhanden.
5. Jede Variante weist einen anderen, ebenfalls nur für Tests erzeugten Client-Key mit einem konkreten Public-Key-Authentifizierungsfehler zurück.

Dies ist ein Fixture-Smoke-Test mit den OpenSSH-Clients. Die xScp-/ssh2-Host-Key-Prüfung ist in M0-04 geprüft; `npm run test:sftp` weist Streaming/Abbruch in M0-05 nach. `npm run test:scp` weist in M0-06 den eigenen SCP-Sender/Empfänger und GNU-find-Auflistung auf der Variante ohne SFTP nach. Die Authentifizierungsmatrix ist in M0-07 geprüft; vollständige SCP-Härtung folgt in M4.

## Isolation und Packaging

Der Containerbenutzer `fixture` ist unprivilegiert; Root-Login, TTY und Forwarding sind deaktiviert. Passwort-/Keyboard-Interactive ist nur in der separaten Auth-Fixture mit PAM aktiviert, in den drei Protokoll-Fixtures weiterhin gesperrt. Der SSH-Daemon läuft containerintern als Root, um den unprivilegierten Benutzer zu starten. Kein privilegierter Container, kein Docker-Socket-Mount und keine Bind-Mounts produktiver Dateien; nur eigene Hostkeys, öffentliche Authorized Keys und bei Auth der Testpassworthash werden eingebunden. Container erhalten 128 MiB RAM, 0,5 CPU und ein Limit von 64 Prozessen. Das ist eine Entwicklungsisolation, keine Sandbox für absichtlich bösartigen Fremdcode.

`.gitignore` schließt `.runtime/` aus; `.dockerignore` hält diese Dateien aus dem Build-Kontext; `.vscodeignore` schließt **den gesamten `test/`- und `scripts/`-Baum** aus der VSIX aus. Die Extension-Bundles importieren keine Fixture-Dateien. VSIX-Inhalte beim späteren Paketieren zusätzlich prüfen.

Das offizielle Debian-Basisimage ist per Multiarch-Digest fixiert. Debian-Pakete werden aus den Debian-Repositories installiert; deren Patchstände können bei einem späteren Neubau variieren. Tatsächliche OpenSSH-/glibc-/Docker-Versionen und Image-ID werden im Prüfbericht festgehalten. Architektur- und Patchstandänderungen erfordern einen erneuten Fixture-Smoke-Test.

[OpenSSH-Konfiguration](https://man.openbsd.org/sshd_config) · [Colima](https://github.com/abiosoft/colima) · [M0-03-Nachweis](../../../docs/nachweise/M0-03.md)

## Authentifizierung und Paketprüfung (M0-07)

```sh
npm run test:auth       # Auth-Port 22223, alle Client-Verfahren, Negativfälle
# macOS mit vorhandener VS-Code-Installation; Python 3 und npm erforderlich:
VSCODE_TEST_EXECUTABLE="/Applications/Visual Studio Code.app/Contents/MacOS/Code" npm run test:packaging
```

`test:auth` erzeugt einen eigenen Vordergrund-`ssh-agent`, lädt ausschließlich die generierten verschlüsselten Testkeys über einen temporären Askpass-Helfer und beendet den Agent danach. Der persönliche Agent und `process.env` werden nicht verändert. Kein Agent Forwarding. Testpasswort/Passphrase werden ausschließlich im ignorierten `.runtime` gespeichert, nicht versioniert oder ausgegeben. Keyboard-Interactive wird über echtes OpenSSH/PAM geprüft, nicht nur über einen Server-Testdouble.

`test:packaging` lädt bei Bedarf die exakt angegebene vsce-Version 4.0.0 in den npm-Cache, baut eine private VSIX, prüft sie mit Python-Standardbibliothek und installiert sie ausschließlich in ein temporäres VS-Code-Profil mit eigener Extensions-Directory. Danach prüft ein Extension-Host-Test den tatsächlich installierten Bundle-Code und entfernt Profil/Paket/Testagent. `VSCODE_CLI` kann die Installations-CLI explizit setzen. Keine Veröffentlichung oder Installation in das normale VS-Code-Profil. [M0-07-Nachweis](../../../docs/nachweise/M0-07.md).

## Remote-SSH-Abnahme (M0-08)

Nur die zusätzliche Remote-Fixture erlaubt lokales TCP-Forwarding zu `localhost`/`127.0.0.1`, damit VS Code Server erreichbar ist. Sie bekommt 1 GiB RAM, eine CPU und 256 PIDs; die vier Protokoll-/Auth-Fixtures behalten 128 MiB, 0,5 CPU und 64 PIDs ohne Forwarding. Kein Agent-/X11-Forwarding, kein Root-Login, kein Passwortzugang im Remote-Container. Der Remote-Test installiert VS Code Server und eine eigene Workspace-Testextension ausschließlich im disposable Container. `fixtures:stop` entfernt auch diese Daten. Generierte SSH-Konfiguration setzt für alle Ziele `IdentityAgent none`, damit keine persönlichen Agent-Identitäten angeboten werden.

## M6-Fehler- und Lasttests

Jeder eigene Container enthält zusätzlich `/limited` als 1-MiB-tmpfs mit Modus 1777. Die M6-Tests legen dort ausschließlich eigene UUID-Verzeichnisse an und prüfen einen echten Schreibfehler bei vollem Dateisystem, ohne den Container- oder Desktop-Datenträger zu füllen. Der lokale macOS-Test verwendet separat ein 16-MiB-Testvolume, das anschließend ausgehängt und entfernt wird.

`npm run test:release` verbindet die gesamte Regression inklusive installierter VSIX, Restricted Mode, echtem Reload und zwei gleichzeitig laufenden VS-Code-Fenstern. Für die Remote-SSH-Abnahme werden die lokalen Testkopien von Remote-SSH 0.128.0 und Remote-SSH-Edit 0.87.0 benötigt; persönliche SSH-Konfigurationen werden nicht verwendet. `npm run benchmark:release` überträgt 4 GiB plus 1 MiB bidirektional über beide Protokolle und misst den Produktions-Queuepfad. Benchmark und Host-Key-Rotationstests müssen nacheinander laufen. Temporäre Profile, Volumes, TCP-Proxys und Testagenten werden beendet; Container abschließend mit `fixtures:stop` entfernen.
