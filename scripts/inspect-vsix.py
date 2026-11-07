"""Inspect the ZIP independently of the VSIX packager; do not print secrets."""
import json
import pathlib
import struct
import sys
import zipfile
from xml.etree import ElementTree

secrets = []
runtime = pathlib.Path('test/fixtures/ssh/.runtime')
for path in runtime.rglob('*'):
    if path.is_file():
        data = path.read_bytes()
        if data.startswith(b'-----BEGIN OPENSSH PRIVATE KEY') or path.name == 'password_hash':
            secrets.append(data)
        if path.name == 'credentials.json':
            secrets.extend(value.encode() for value in json.loads(data).values())
with zipfile.ZipFile(sys.argv[1]) as archive:
    names = archive.namelist()
    for name in names:
        parts = pathlib.PurePosixPath(name).parts
        assert '..' not in parts and not name.startswith('/'), 'Unsafe ZIP path'
        assert not any(part in ('test','scripts','node_modules','.runtime','.git','.github','src','webview','out') for part in parts), 'Development material in VSIX'
        assert not name.endswith(('.node','.exe','.map','.vsix')), 'Unexpected native/helper artifact'
        assert 'eslint.config.js' not in parts, 'Development configuration in VSIX'
        assert not any(secret in archive.read(name) for secret in secrets), 'Fixture secret in VSIX'
    for required in ('LICENSE.txt','package.json','package.nls.json','package.nls.de.json','dist/extension.cjs','dist/webview.js','dist/webview.css','THIRD_PARTY_NOTICES.md','media/CODICONS-LICENSE.txt','l10n/bundle.l10n.json','l10n/bundle.l10n.de.json'):
        assert 'extension/'+required in names, 'Missing runtime artifact or notice'
    assert any(name.endswith('.ttf') for name in names), 'Missing local icon font'
    manifest = json.loads(archive.read('extension/package.json'))
    source_manifest = json.loads(pathlib.Path('package.json').read_text())
    identity = ElementTree.fromstring(archive.read('extension.vsixmanifest')).find('.//{*}Identity')
    assert identity is not None, 'Missing VSIX identity'
    for field, attribute in [('publisher', 'Publisher'), ('name', 'Id'), ('version', 'Version')]:
        assert manifest[field] == source_manifest[field], 'Packaged identity differs from source'
        assert identity.get(attribute) == manifest[field], 'VSIX identity differs from package manifest'
    assert manifest.get('l10n') == './l10n', 'Missing VS Code localization bundle path'
    assert manifest.get('license') == 'MIT', 'Missing MIT license metadata'
    assert archive.read('extension/LICENSE.txt') == pathlib.Path('LICENSE').read_bytes(), 'Packaged license differs from source'
    en = json.loads(archive.read('extension/package.nls.json'))
    de = json.loads(archive.read('extension/package.nls.de.json'))
    assert set(en) == set(de), 'Incomplete manifest localization'
    assert manifest['extensionKind'] == ['ui']
    assert manifest['engines']['vscode'] == '^1.140.0'
    assets = [manifest['icon']]
    for command in manifest['contributes']['commands']:
        icon = command.get('icon')
        if isinstance(icon, str) and not icon.startswith('$('):
            assets.append(icon)
        elif isinstance(icon, dict):
            assets.extend(icon.values())
    for container in manifest['contributes']['viewsContainers']['activitybar']:
        assets.append(container['icon'])
    for asset in assets:
        assert isinstance(asset, str) and not asset.startswith('/') and '..' not in pathlib.PurePosixPath(asset).parts, 'Unsafe manifest asset path'
        assert 'extension/' + asset in names, 'Missing manifest icon'
        assert archive.read('extension/' + asset) == pathlib.Path(asset).read_bytes(), 'Packaged icon differs from source'
    icon = archive.read('extension/' + manifest['icon'])
    assert icon[:8] == b'\x89PNG\r\n\x1a\n' and icon[12:16] == b'IHDR', 'Marketplace icon must be a PNG'
    width, height = struct.unpack('>II', icon[16:24])
    assert 0 < width <= 1024 and 0 < height <= 1024, f'Marketplace icon exceeds 1024 x 1024 pixels: {width} x {height}'
    icon_asset = next((asset for asset in ElementTree.fromstring(archive.read('extension.vsixmanifest')).findall('.//{*}Asset')
                       if asset.get('Type') == 'Microsoft.VisualStudio.Services.Icons.Default'), None)
    assert icon_asset is not None and icon_asset.get('Path') == 'extension/' + manifest['icon'], 'Marketplace icon asset differs from package manifest'
    print(f'Marketplace-Icon geprüft: {width} x {height} Pixel.')
    print(f'VSIX geprüft: {len(names)} Dateien; keine Entwicklungsdateien, nativen Addons oder Fixture-Geheimnisse.')
