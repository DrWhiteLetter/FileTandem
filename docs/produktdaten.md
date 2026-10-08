# Öffentliche Produktdaten – M6-08 vorgezogen

Stand: 8. Oktober 2026. **Vorbereitung, noch keine abschließende Produktidentität.** Auf Benutzerwunsch vor M6-01 bis M6-07 bearbeitet. Technische Release-Abnahmen bleiben davon unberührt. Keine Veröffentlichung beauftragt.

## Name

Der Benutzer möchte neue Namen statt xScp vorgeschlagen bekommen. Empfehlung: **PortTandem**, Alternative: **PaneJet**. Auswahl steht aus; aktuelle UI und Extension-ID bleiben bis dahin konsistent bei xScp / `xscp-dev.xscp`.

| Vorschlag | Vorteil | Nachteil / Recherche |
| --- | --- | --- |
| PortTandem | Verbindung und zwei Fenster; für SFTP/SCP passend, gut aussprechbar | Länger, Bedeutung braucht beschreibenden Untertitel; in der Web-/Marketplace-Suche kein eindeutiger gleichnamiger Client gefunden |
| PaneJet | Kurz, betont Fenster und Übertragung | Englisches „Pane“ weniger verständlich; Wort auch außerhalb Software verwendet; kein eindeutiger gleichnamiger Client gefunden |

Nicht empfohlen: xScp kollidiert sprachlich mit dem [XSCP-Kommunikationsprotokoll](https://xscp.ivanamon.dev/intro.html); [PortPane](https://shackdesk.com/portpane/) ist bereits Software; [Docklane](https://docklane.dev/) ist bereits ein SSH-Client. Suchergebnisse sind eine erste Kollisionsprüfung, keine Namensreservierung oder rechtliche Freigabe. Marketplace-Suche ohne Treffer beweist keine Verfügbarkeit; endgültige Annahme ist bei der Produktregistrierung zu prüfen.

Recherche am 08.10.2026: exakte Namen und Kombinationen mit Software/App/SFTP sowie `site:marketplace.visualstudio.com`. Keine Domain oder Marke registriert.

## Publisher und Identität

`xscp-dev` ist ausschließlich der bestehende Entwicklungsplatzhalter. Ein tatsächlich vorhandenes Konto mit Veröffentlichungsrecht ist bislang nicht nachgewiesen. Benötigt werden Publisher-ID und öffentlicher Herausgebername; die ID wird danach im Manifest und in den installierten Extension-Tests konsistent umgesetzt. Kein erfundenes Konto oder öffentlicher Repository-/Support-Link.

Nach [offizieller Publishing-Anleitung](https://code.visualstudio.com/api/working-with-extensions/publishing-extension) ist die Publisher-ID nach Erstellung unveränderlich. Die Extension-ID besteht aus `publisher.name` ([Manifest](https://code.visualstudio.com/api/references/extension-manifest)). Wechsel dieser ID ist eine neue Extension-Identität und benötigt einen bewusst dokumentierten Übergang für bestehende Installation und gespeicherte Profile/Secrets. Eine sichtbare Namensänderung allein verlangt keinen Wechsel der internen `xscp.*`-Befehle, Einstellungen oder URI-Schemes.

## Vorbereitete Marketplace-Texte

Titel nach Auswahl: **PortTandem – SFTP & SCP File Manager** beziehungsweise **PaneJet – SFTP & SCP File Manager**. Im Plugin kann der kurze Produktname verwendet werden.

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
- [ ] Produktname durch Benutzer ausgewählt und sichtbares Branding umgesetzt.
- [ ] Tatsächlich verfügbarer Publisher und Herausgebername nachgewiesen; Identität/Übergang umgesetzt.

M6-08 bleibt bis zu diesen Entscheidungen offen. Die fehlenden externen Angaben blockieren weder Entwicklung noch private VSIX-Nutzung. M6-09 bleibt ein eigener Schritt mit ausdrücklichem Veröffentlichungsauftrag.
