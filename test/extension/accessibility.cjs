const assert=require('node:assert/strict'),vscode=require('vscode'),fs=require('node:fs/promises'),path=require('node:path');
exports.run=async () => {
  const api=await vscode.extensions.getExtension('RootShellForge.filetandem').activate();const folder=path.join(path.dirname(process.env.FILETANDEM_EDITOR_MARKER),'ten-thousand');await fs.mkdir(folder);
  for (let offset=0;offset<10000;offset+=200) await Promise.all(Array.from({length:200},(_,i) => fs.writeFile(path.join(folder,'file-'+String(offset+i).padStart(5,'0')+'.txt'),'')));
  const panel=api.manager.open(undefined,{version:1,paths:{local:folder}});api.manager.diagnostics(true);
  const wait=async predicate => {const deadline=Date.now()+15000;while (!predicate()) {if (Date.now()>deadline) throw new Error('Webview geometry acceptance timeout: '+JSON.stringify(api.manager.status()));await new Promise(r => setTimeout(r,100));}};
  for (const [theme,expected,zoom] of [['Default Dark Modern','vscode-dark',0],['Default High Contrast','vscode-high-contrast',2],['Default High Contrast Light','vscode-high-contrast-light',1]]) {
    await vscode.workspace.getConfiguration('workbench').update('colorTheme',theme,vscode.ConfigurationTarget.Global);await vscode.workspace.getConfiguration('window').update('zoomLevel',zoom,vscode.ConfigurationTarget.Global);
    await wait(() => api.manager.status().views.some(v => v.local.count===10000 && v.renderProof?.theme===expected && v.renderProof.rows>0));
    const proof=api.manager.status().views.find(v => v.local.count===10000).renderProof;
    assert.ok(proof.rows<100,'10,000 files use fewer than 100 rendered rows');assert.ok(Math.abs(proof.rowHeight-36)<0.1,'Zoom subpixel rounding stays below 0.1 CSS pixels');assert.ok(proof.height>0);assert.ok(proof.scrollHeight>=360000);assert.ok(proof.focusColor,'VS Code supplies a visible focus color');console.log('M5-07: '+JSON.stringify({theme,zoom,...proof}));
  }
  panel.dispose();api.manager.diagnostics(false);
};
