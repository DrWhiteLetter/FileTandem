/** Move state within the existing extension identity; never export secrets. */
export async function migrateNamespace(context,workspace,target) {
  const settings=['showHiddenFiles','demoScenario','editorPollInterval','commanderKeys','language'];
  for (const setting of settings) {
    const config=workspace.getConfiguration();
    const old=config.inspect('xscp.'+setting)?.globalValue;
    if (old === undefined) continue;
    if (config.inspect('filetandem.'+setting)?.globalValue === undefined) await config.update('filetandem.'+setting,old,target);
    await config.update('xscp.'+setting,undefined,target);
  }
  const legacy=context.globalState.get('xscp.profiles.v1');
  const profiles=context.globalState.get('filetandem.profiles.v1') ?? legacy;
  const secrets=['xscp.journal.integrity.v1'];
  for (const profile of [...(legacy?.profiles ?? []),...(profiles?.profiles ?? [])]) for (const kind of ['password','passphrase']) secrets.push(`xscp.profile.${profile.id}.${kind}`);
  for (const old of secrets) {
    const key=old.replace(/^xscp\./,'filetandem.');
    const value=await context.secrets.get(old);
    if (value !== undefined && await context.secrets.get(key) === undefined) await context.secrets.store(key,value);
    if (value !== undefined) await context.secrets.delete(old);
  }
  for (const old of context.globalState.keys().filter(key => key.startsWith('xscp.'))) {
    const key=old.replace(/^xscp\./,'filetandem.');
    if (context.globalState.get(key) === undefined) await context.globalState.update(key,context.globalState.get(old));
    await context.globalState.update(old,undefined);
  }
}
