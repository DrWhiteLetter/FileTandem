import { build, context } from 'esbuild';

const watch = process.argv.includes('--watch');
const shared = { bundle: true, sourcemap: true, logLevel: 'info' };
const bundles = [
  { ...shared, entryPoints: ['src/extension.js'], outfile: 'dist/extension.cjs',
    platform: 'node', format: 'cjs', target: 'node22', external: ['vscode'] },
  { ...shared, entryPoints: ['webview/src/main.jsx'], outfile: 'dist/webview.js',
    platform: 'browser', format: 'iife', target: 'es2022', jsx: 'automatic' },
];
if (watch) {
  const contexts = await Promise.all(bundles.map(options => context(options)));
  await Promise.all(contexts.map(ctx => ctx.watch()));
  const stop = async () => {
    await Promise.all(contexts.map(ctx => ctx.dispose()));
    process.exit(0);
  };
  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
} else {
  await Promise.all(bundles.map(options => build(options)));
}
