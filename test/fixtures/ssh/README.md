# Isolierte SSH-Testumgebungen

M0-03 stellt drei lokale OpenSSH-Container bereit. Sie sind Testmaterial für xScp und benötigen keinen VS Code Server. Alle Zugänge sind ausschließlich auf `127.0.0.1` veröffentlicht.

| Alias in generierter SSH-Konfiguration | Port | SFTP | Shell / Exec | Echtes SCP |
| --- | ---: | --- | --- | --- |
| `xscp-fixture-sftp` | 22220 | Ja | Ja | Möglich |
| `xscp-fixture-sftp-only` | 22221 | Ja | Durch `ForceCommand internal-sftp` blockiert | Blockiert |
| `xscp-fixture-scp` | 22222 | Kein SFTP-Subsystem | Ja, GNU find/coreutils | Ja, `scp -O` |

Benutzer: `fixture`. Anmeldung ausschließlich mit dem lokal generierten Ed25519-Testschlüssel; kein Passwort. Datenbereich: `/data`; jeder Start erzeugt frische Container und verwirft zuvor dort geschriebene Testdaten. Der SFTP-Startordner ist `/data`. Der Shell-Login startet im Home-Verzeichnis; für Shell-/SCP-Tests absolute `/data/...`-Pfade benutzen.

## Voraussetzungen

Node.js gemäß Projekt-README, Docker-CLI mit laufendem **lokalem Linux-Docker-Daemon**, OpenSSH-Clients `ssh`, `sftp`, `scp` und `ssh-keygen`. Host-Ports 22220–22222 müssen frei sein. Image-Build benötigt Netzwerkzugriff für Debian-Pakete; laufende Testcontainer verwenden ein eigenes Docker-Bridge-Netzwerk. Eingehende SSH-Zugriffe sind auf die veröffentlichten Loopback-Ports begrenzt; ausgehender Netzwerkzugriff ist durch Docker nicht gesperrt.

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
npm run fixtures:start   # erzeugt Keys, baut Image und wartet auf alle drei Zugänge
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
- `servers/<variante>/authorized_keys`: nur der öffentliche Testclient-Key.
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

Die App-Host-Key-Dialoge folgen erst in M0-04. Hier prüfen OpenSSH-Clients die kontrollierten Fixture-Hostidentitäten. Testkeys nie für andere Server verwenden. Die privaten Client-Keys werden nicht in das Container-Image oder in Servercontainer kopiert; nur der jeweilige Host-Key und öffentliche Authorized Key werden read-only eingebunden.

## Was `fixtures:verify` nachweist

1. Alle drei Container laufen und sind mit dem richtigen Testkey erreichbar.
2. SFTP und SFTP-only: kleine Datei hoch-/herunterladen, bytegleich vergleichen, Remote-Probe entfernen.
3. SFTP-only: Shell-Marker wird nicht ausgeführt und Legacy-SCP wird abgewiesen.
4. SCP: SFTP-Subsystem ausdrücklich abgewiesen; Upload und Download mit `scp -O` bytegleich; GNU find/coreutils vorhanden.
5. Jede Variante weist einen anderen, ebenfalls nur für Tests erzeugten Client-Key mit einem konkreten Public-Key-Authentifizierungsfehler zurück.

Dies ist ein Fixture-Smoke-Test mit den OpenSSH-Clients. Die xScp-/ssh2-Implementierung, Streaming/Abbruch, SCP-Parser und Authentifizierungsmatrix werden in M0-04 bis M0-07 geprüft.

## Isolation und Packaging

Der Containerbenutzer `fixture` ist unprivilegiert; Root-Login, Passwort-/Keyboard-Interactive-Anmeldung, TTY und Forwarding sind deaktiviert. Der SSH-Daemon läuft containerintern als Root, um den unprivilegierten Benutzer zu starten. Kein privilegierter Container, kein Docker-Socket-Mount und keine Bind-Mounts produktiver Dateien; nur die eigenen Server-Testkeys werden eingebunden. Container erhalten 128 MiB RAM, 0,5 CPU und ein Limit von 64 Prozessen. Das ist eine Entwicklungsisolation, keine Sandbox für absichtlich bösartigen Fremdcode.

`.gitignore` schließt `.runtime/` aus; `.dockerignore` hält diese Dateien aus dem Build-Kontext; `.vscodeignore` schließt **den gesamten `test/`- und `scripts/`-Baum** aus der VSIX aus. Die Extension-Bundles importieren keine Fixture-Dateien. VSIX-Inhalte beim späteren Paketieren zusätzlich prüfen.

Das offizielle Debian-Basisimage ist per Multiarch-Digest fixiert. Debian-Pakete werden aus den Debian-Repositories installiert; deren Patchstände können bei einem späteren Neubau variieren. Tatsächliche OpenSSH-/glibc-/Docker-Versionen und Image-ID werden im Prüfbericht festgehalten. Architektur- und Patchstandänderungen erfordern einen erneuten Fixture-Smoke-Test.

[OpenSSH-Konfiguration](https://man.openbsd.org/sshd_config) · [Colima](https://github.com/abiosoft/colima) · [M0-03-Nachweis](../../../docs/nachweise/M0-03.md)
