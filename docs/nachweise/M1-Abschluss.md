# M1 – Implementierung und Abnahmestand

Alle sieben Items wurden umgesetzt und jeweils separat committed. Die installierbare Commander-Demo umfasst zwei Dateilisten, Navigation, Auswahl/Sortierung, Toolbar, Status, Queue, Demo-Zustände, Tastaturgrundbedienung, Theme-Variablen/Codicons, validierte Session-Nachrichten und persistierten UI-Zustand. Die Demo führt keine SSH-Verbindungen oder Transfers aus; produktive Integration folgt M2/M3.

Am 07.10.2026 bestanden auf macOS arm64 mit Node 22.13.1 und VS Code 1.140.0: ESLint, Syntaxprüfung, 22 Unit-Tests, gerenderter React-DOM-Test, Build, ZIP-/Geheimnisausschlussprüfung und Aktivierung/Webview-Handshake der installierten VSIX in sauberem temporären Profil.

Noch offene Abnahmen: echte native Restricted-Mode-Bedienprüfung (negative zentrale Policy und Manifest sind getestet), visuelle Light/Dark/High-Contrast-/Zoom-Matrix, vollständiger nativer Fensterneustart mit Serializer sowie gehosteter CI-Lauf und Windows-/Linux-Desktop. M1 ist damit implementiert und lokal installierbar; eine vorbehaltlos vollständige Bedienabnahme wird nicht behauptet. Die offenen nativen Prüfungen werden in M6 nachgeholt; gehostete CI benötigt ein Remote-Repository.

Item-Nachweise: [01](M1-01.md), [02](M1-02.md), [03](M1-03.md), [04](M1-04.md), [05](M1-05.md), [06](M1-06.md), [07](M1-07.md). Commit-Zuordnung ist über `git log --oneline --grep=M1-` nachvollziehbar.
