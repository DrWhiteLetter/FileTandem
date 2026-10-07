// Optional ssh2 accelerators are not packaged. ssh2 catches missing imports
// and uses its JavaScript/Node crypto implementation.
export const hostBundleOptions = {
  platform: 'node', format: 'cjs', target: 'node22',
  external: ['vscode', 'cpu-features', './crypto/build/Release/sshcrypto.node'],
};
