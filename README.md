<p>
  <img src="media/filetandem-logo.png" alt="FileTandem logo" width="112" height="112">
</p>

# FileTandem — SFTP/SCP File Manager

**Local files and your server, side by side in VS Code.**

Transfer folders over SFTP/SCP, compare changes and edit remote files without leaving your editor. For SFTP, an SFTP account is enough — no VS Code Server required.

**[Install from Marketplace](https://marketplace.visualstudio.com/items?itemName=RootShellForge.filetandem)** · [Deutsche Anleitung](README.de.md) · [Changes](CHANGELOG.md) · [Report an issue](https://github.com/DrWhiteLetter/FileTandem/issues)

Free and open source · MIT licence · English and German interface · Version 1.0.4

![FileTandem 1.0.4: compact transfer controls and history menu](media/filetandem-1.0.4.png)

*Current interface with synthetic test data; no real transfer in this screenshot.*

![FileTandem quick tour: connection, upload and remote editor on an isolated test server](media/filetandem-quick-tour.gif)

*Historical 27-second silent montage from the real FileTandem 1.0.1 recording (transfer toolbar predates 1.0.4) on an isolated test server. German interface; cuts between connection, upload and editor scenes. [Text walkthrough](docs/first-transfer-feedback.md).*

## Why FileTandem?

- **Two panes, one workspace.** Browse local and remote folders side by side, select files and upload or download them with a visible transfer queue.
- **Use your existing SFTP access.** Connect with a password, SSH key or SSH agent. No VS Code Server installation on the target is needed for SFTP.
- **Review changes and control editing.** Preview folder comparisons, compare editor contents with the server and explicitly enable remote editing.

Useful when you maintain a website or move project files to a server and want the file manager inside VS Code. You can also copy between two local folders without a server profile.

## Your first transfer

1. Install **FileTandem – SFTP/SCP File Manager** by **RootShellForge**. In VS Code Extensions, search for `@id:RootShellForge.filetandem`.
2. Run **FileTandem: Open file manager** from the Command Palette. Create a server profile and choose your local and remote start folders.
3. Connect and verify the SSH fingerprint against a trusted value from your administrator or hosting provider.
4. Select a disposable test file on the left and choose **Upload →**. Check the destination and transfer result before working with project files.

Requires **VS Code Desktop 1.140.0 or later**. Node.js is not required for installation. SFTP needs an SFTP account; SCP needs a GNU/Linux server with a shell and `scp` installed.

## Remote editing and folder transfers

Remote files open read-only initially. Enable editing deliberately: saving an SFTP file writes to the server, including when Auto Save is enabled. With SCP, edit a local copy and explicitly upload it again.

Folder comparison offers a preview. **Keep remote folder up to date** mirrors local changes, including removals; check source and destination before starting. Exclusion rules and backups are respected. Remote deletions use `.bak` backups by default; on web servers, prevent these backups from being downloaded publicly.

Manual SFTP uploads check SSH transport, source consistency and file size by default. Optional SHA-256 verification reads the uploaded file back. Resumed SFTP uploads, automatic uploads and verified editor uploads use SHA-256. These checks do not replace backups.

## Help shape the first-transfer experience

Try the [10-minute test guide](docs/first-transfer-feedback.md) and tell us where you got stuck. Could you connect, find the destination and transfer your first file? Usability feedback is welcome even when nothing crashes.

[Send first-transfer feedback](https://github.com/DrWhiteLetter/FileTandem/issues/new?template=first-transfer.yml) · [Report a bug](https://github.com/DrWhiteLetter/FileTandem/issues/new?template=bug-report.yml)

After using FileTandem, an honest [Marketplace review](https://marketplace.visualstudio.com/items?itemName=RootShellForge.filetandem&ssr=false#review-details) helps others decide whether it fits their workflow.

## Compatibility and documentation

Automated local release and installation checks cover macOS on Apple Silicon. The project owner has also reported successful manual desktop tests on Windows and Debian 13.7 / Xfce / ARM64. These are specific test reports, not coverage of every operating system, architecture or remote environment. See the [documented environments](README.de.md#getestete-desktop-umgebungen).

[Detailed German guide](README.de.md) · [Operating notes and limitations (German)](docs/release-anleitung.md) · [Security reporting](SECURITY.md)

### Upgrading from the old extension identity

Since 1.0.3 the extension ID is `RootShellForge.filetandem`. Older identities are separate extensions: profiles and secrets do not migrate automatically. Before switching, stop transfers and monitoring, export profiles without secrets and disable the old extension. Recreate profiles and credentials in the new extension and verify host keys independently. See [migration details (German)](docs/identitaetswechsel-filetandem.md).

## Contributing and support

For issues, include FileTandem and VS Code versions, OS, architecture, protocol and reproduction steps. Do not post credentials, private keys or unsanitised logs. Use [SECURITY.md](SECURITY.md) for confidential security reports.

Development requires Node.js 22.13.1 or later. Run `npm ci`, then `npm start`. `npm run quality` runs the quality checks and builds the extension. Every VSIX build must follow the [release process](docs/vsix-releaseprozess.md).

[Support development via PayPal](https://paypal.me/TobiasKohlhepp) · [MIT licence](LICENSE) · [Third-party notices](THIRD_PARTY_NOTICES.md)
