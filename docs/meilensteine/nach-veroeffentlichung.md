# Geplante Funktionen nach der Veröffentlichung

Diese Liste ergänzt die Release-Meilensteine. Die Funktionen sind vorgemerkt, noch nicht umgesetzt und keine Voraussetzung für die erste öffentliche Veröffentlichung.

## POST-01: Vorhandene SSH-Verbindungen und Sprungserver nutzen

Aufgenommen am 31.10.2026 auf Benutzerwunsch. Umsetzung nach der ersten öffentlichen Veröffentlichung; noch kein Termin festgelegt.

**Nutzen:** Bereits eingerichtete Serververbindungen übernehmen, statt ihre Daten erneut einzutragen. Auch Server erreichen, die nur über einen oder mehrere vorgeschaltete Server zugänglich sind.

- [ ] Vorhandene SSH-Konfigurationen einlesen und ihre benannten Verbindungen zur Auswahl anbieten, einschließlich Serveradresse, Benutzername, Port und Schlüsseldatei. Die Quelldateien bleiben unverändert.
- [ ] Verbindungen über einen Sprungserver unterstützen; anschließend auch mehrere Zwischenstationen ermöglichen (`ProxyJump`). Den Verbindungsweg verständlich anzeigen.
- [ ] Anmeldung und Prüfung der Serveridentität für jede Zwischenstation und den Zielserver getrennt behandeln. Fehler erklären, an welcher Station die Verbindung scheitert.
- [ ] Nicht unterstützte Konfigurationsangaben verständlich melden. Ausführbare Proxy-Konfigurationen (`ProxyCommand`) gesondert bewerten; keine ungeprüfte Ausführung beim Einlesen.
- [ ] Direkte Verbindungen und weiterhin manuell gepflegte FileTandem-Profile beibehalten.
- [ ] Bedienung und Hilfetexte auf Deutsch und Englisch anbieten und SFTP sowie SCP über eine und mehrere Zwischenstationen testen.

**Fertig, wenn:** Eine vorhandene benannte SSH-Verbindung ohne erneute Eingabe ihrer Verbindungsdaten nutzbar ist und Dateiübertragungen über eine sowie mehrere Zwischenstationen funktionieren. Abbruch, fehlgeschlagene Anmeldung und geänderte Serveridentitäten werden für jede Station geprüft und verständlich angezeigt.
