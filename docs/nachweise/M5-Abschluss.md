# M5 abgeschlossen

**8/8 Items umgesetzt und je Item committed.** Private Version 0.0.5 enthält produktive SFTP-Editor-URIs, ausdrückliche Freigabe/Speichern, geprüfte Konfliktauflösung, Diff/aktive Änderungsprüfung, unabhängige Sitzungsansichten, interne Drag-and-drop-Transfers, Kontextmenüs/Commander-Tasten, virtualisierte Listen und Deutsch/Englisch. SCP wird über lokale Editorkopien mit ausdrücklichem Queue-Upload bearbeitet.

Nachweise: [M5-01](M5-01.md), [M5-02](M5-02.md), [M5-03](M5-03.md), [M5-04](M5-04.md), [M5-05](M5-05.md), [M5-06](M5-06.md), [M5-07](M5-07.md), [M5-08](M5-08.md). [Installieren und bedienen](M5-Anleitung.md).

47 Unit-Tests, drei React-Tests, Lint/Check/Build, 31 Protokolltests sowie tatsächliche isolierte VS-Code-Abnahmen bestehen. Die VSIX wurde installiert geprüft: englisches lokales Fenster, reales Remote-SSH-Fenster inklusive Cross-Host-Provider und Auto Save, beide Protokolle und normale Starts mit persistentem Neustart. 10.000 wirkliche lokale Dateien wurden im nativen Webview bei Dark/High Contrast/High Contrast Light und Zoom 0/2/1 geprüft. Keine produktiven Server, kein Publisher-Upload und keine Änderung persönlicher VS-Code-/SSH-Konfiguration. Eigene Testcontainer/VM anschließend gestoppt.

Bekannte Grenzen: 10-MiB-Editorlimit/32 Ressourcen, begrenzte UTF-8-Diff-Snapshots, 64 private SCP-Kopien, Server-CAS-Race, keine Zusage für Eigentümer/ACLs/Xattrs. Windows/Linux-Desktop, komplette manuelle Screenreader- und Fehler-/Lastmatrix, Lizenz-/Release-Dokumentation und optionale öffentliche Veröffentlichung bleiben M6. Nächste Aufgabe: **M6-01**.
