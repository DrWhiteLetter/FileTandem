"""Inspect the ZIP independently of the VSIX packager; do not print secrets."""
import json
import pathlib
import sys
import zipfile

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
    for required in ('package.json','package.nls.json','package.nls.de.json','dist/extension.cjs','dist/webview.js','dist/webview.css','THIRD_PARTY_NOTICES.md','media/CODICONS-LICENSE.txt'):
        assert 'extension/'+required in names, 'Missing runtime artifact or notice'
    assert any(name.endswith('.ttf') for name in names), 'Missing local icon font'
    manifest = json.loads(archive.read('extension/package.json'))
    en = json.loads(archive.read('extension/package.nls.json'))
    de = json.loads(archive.read('extension/package.nls.de.json'))
    assert set(en) == set(de), 'Incomplete manifest localization'
    assert manifest['extensionKind'] == ['ui']
    assert manifest['engines']['vscode'] == '^1.140.0'
    print(f'VSIX geprüft: {len(names)} Dateien; keine Entwicklungsdateien, nativen Addons oder Fixture-Geheimnisse.')
