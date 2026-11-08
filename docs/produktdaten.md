# Öffentliche Produktdaten – M6-08 vorgezogen

> **Aktueller Stand, 08.11.2026:** Paketname `filetandem`, Publisher `RootShellForge`, Ziel-ID `RootShellForge.filetandem`. Version 1.0.3; Veröffentlichungsstatus im [Release-Nachweis](nachweise/Release-1.0.3.md). Übergang und Altkennungen: [Identitätswechsel](identitaetswechsel-filetandem.md). Die folgenden Planungsstände bleiben historisch.

Stand: 8. Oktober 2026. **Name übernommen und juristisches Okay durch den Benutzer bestätigt; Publisher noch offen.** Technische Release-Abnahmen bleiben davon unberührt. Keine Veröffentlichung beauftragt.

## Name

Am 08.10.2026 hat der Benutzer **FileTandem** und **FileTandem – SFTP & SCP File Manager** als Marketplace-Titel gewählt und die Übernahme ausdrücklich beauftragt. Manifest, Befehle, Activity Bar, Fenster, Dialoge, Webview und aktuelle Bedienungsanleitung verwenden den Namen. Private Version: **0.0.8** mit eigenem Logo, Öffnen-Button und lokaler M6-Abnahme.

Die kurze Web-/Marketplace-Recherche zu „FileTandem“ und „File Tandem“ ergab keinen eindeutig gleichnamigen Software-/Marketplace-Eintrag. Das ist kein Verfügbarkeits- oder Rechtsnachweis. Die direkte DPMA-/EUIPO-Vorrecherche ist inzwischen dokumentiert: [Registerrecherche vom 08.10.2026](nachweise/M6-08-Markenrecherche.md). FileTandem ergab in beiden Registern keine Treffer; Tandem umfasst aber auch softwarebezogene Marken und tatsächlich laufende Widersprüche. Eine vollständige Register-/Ähnlichkeitsprüfung einschließlich WIPO wurde hier nicht abgeschlossen; „Tandem“ wird bereits von [Softwareanbietern](https://usetandem.ai/) verwendet. [DPMA-Recherchehinweise](https://www.dpma.de/marken/markenrecherche/index.html) erläutern die Bedeutung ähnlicher Marken.

**Juristische Prüfung:** Der Benutzer bestätigt am 08.10.2026: „juristisch habe ich das Ok für File Tandem bekommen“. Diese Rückmeldung schließt die beauftragte Namensprüfung im Projekt ab; das bestehende Branding **FileTandem** bleibt erhalten. Das juristische Dokument selbst liegt im Repository nicht vor. Keine Domain/Marke registriert und keine öffentliche Veröffentlichung ausgeführt.

Seit 0.0.9 verwenden Einstellungen, Befehle, Ansichten und Editor-URIs `filetandem`. Gespeicherte Einstellungen/State-/Secret-Schlüssel werden migriert. Paketname `xscp` und vorläufige Extension-ID `xscp-dev.xscp` bleiben bis zur Publisher-Festlegung erhalten, damit vorhandene Profile und SecretStorage-Daten weiterhin zugänglich sind. Historische Nachweise behalten ihren damaligen Namen und ihre geprüfte Version.

## Publisher und Identität

Der bisherige Entwicklungsplatzhalter `xscp-dev` wurde auf Benutzeranweisung durch die Publisher-ID `RootShellForge` ersetzt. Manifest, Einstellungsfilter und installierte Extension-Tests verwenden die neue Identität. Der Paketbau bestätigt diese Metadaten; die Kontoberechtigung und die Freischaltung im Marketplace werden durch einen lokalen Build nicht geprüft.

Nach [offizieller Publishing-Anleitung](https://code.visualstudio.com/api/working-with-extensions/publishing-extension) ist die Publisher-ID nach Erstellung unveränderlich. Die Extension-ID besteht aus `publisher.name` ([Manifest](https://code.visualstudio.com/api/references/extension-manifest)). Wechsel dieser ID ist eine neue Extension-Identität und benötigt einen bewusst dokumentierten Übergang für bestehende Installation und gespeicherte Profile/Secrets. Eine sichtbare Namensänderung allein verlangt keinen Wechsel der internen `xscp.*`-Befehle, Einstellungen oder URI-Schemes.

## Vorbereitete Marketplace-Texte

Festgelegter Marketplace-/Manifest-Titel: **FileTandem – SFTP & SCP File Manager**. In der Bedienoberfläche: **FileTandem**.

**Deutsch, Kurzbeschreibung:** Zwei-Fenster-Dateimanager für SFTP und SCP in VS Code Desktop, mit Transferwarteschlange und kontrollierter Remote-Bearbeitung.

**English, short description:** Dual-pane SFTP and SCP file manager for VS Code Desktop, with a transfer queue and guarded remote editing.

**Deutsch, Einführung:** Verwalte lokale Dateien und Serverdateien nebeneinander, übertrage Dateien und Ordner und behalte deine Aufträge in der gemeinsamen Warteschlange im Blick. SFTP-Dateien öffnen zunächst schreibgeschützt; nach ausdrücklicher Freigabe kannst du sie im VS-Code-Editor bearbeiten und Änderungen vergleichen. Bei SCP bearbeitest du eine lokale Kopie und lädst sie bewusst hoch.

**English, introduction:** Browse local and server files side by side, transfer files and folders, and track work in a shared queue. SFTP files open read-only until you explicitly enable editing in VS Code. Compare changes before saving. For SCP, edit a local copy and explicitly upload it when ready.

Kategorie: `Other`; Suchbegriffe für finale Metadaten: `sftp`, `scp`, `ssh`, `file transfer`, `dual pane`. Keine FTP-/FTPS-, Sync-, Terminal-, Browser- oder ungeprüfte Plattformzusage. Unterstützte Systeme und Untergrenze bleiben an M6-02/M6-07 gebunden. Screenshots/Icon sowie finale Store-README/Support-/Repository-Adressen folgen der tatsächlichen Release-Dokumentation in M6-06.

## Lizenz

Die in M0-09 beschlossene MIT-Lizenz ist als [`LICENSE`](../LICENSE) umgesetzt; Copyright 2026 Tobias Kohlhepp entspricht dem lokalen Git-Autor. `package.json` und Root-Lock-Metadaten enthalten `MIT`. Bestehende Drittanbieterhinweise bleiben separat. Grundlage: [OSI-MIT-Text](https://opensource.org/license/mit).

Paketierung verwendet keine `--skip-license`-Ausnahme mehr. VSCE normalisiert die Datei im Paket zu `extension/LICENSE.txt`; die unabhängige ZIP-Prüfung verlangt ihren bytegleichen Inhalt und die MIT-Metadaten.

## Abschlusskriterien

- [x] Lizenzdatei und Metadaten umgesetzt; Paketierung geprüft.
- [x] Namensvorschläge recherchiert und Texte vorbereitet.
- [x] Produktname durch Benutzer ausgewählt und sichtbares Branding umgesetzt.
- [x] Beauftragte juristische Prüfung laut Benutzer-Rückmeldung abgeschlossen.
- [ ] Tatsächlich verfügbarer Publisher und Herausgebername nachgewiesen; Identität/Übergang umgesetzt.

M6-08 bleibt bis zum Publisher-Nachweis offen. Die fehlenden externen Angaben blockieren weder Entwicklung noch private VSIX-Nutzung. M6-09 bleibt ein eigener Schritt mit ausdrücklichem Veröffentlichungsauftrag.
