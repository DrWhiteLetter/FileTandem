import { build } from 'esbuild';
import { runTests } from '@vscode/test-electron';
import { fileURLToPath } from 'node:url';
delete process.env.ELECTRON_RUN_AS_NODE;
const root=fileURLToPath(new URL('..',import.meta.url));
await build({entryPoints:[`${root}/src/vscode/image-preview.js`],bundle:true,platform:'node',format:'cjs',outfile:`${root}/out/image-preview-service.cjs`});
await runTests({version:'1.140.0',extensionDevelopmentPath:root,extensionTestsPath:`${root}/test/extension/image-preview.cjs`,launchArgs:['--disable-extensions','--skip-welcome','--skip-release-notes','--disable-workspace-trust']});
