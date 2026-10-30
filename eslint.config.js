import globals from 'globals';
export default [
  { ignores: ['node_modules/**', 'dist/**', 'out/**', '.vscode-test/**', 'test/fixtures/ssh/.runtime/**'] },
  { files: ['**/*.{js,mjs,cjs,jsx}'], languageOptions: { ecmaVersion: 2025, sourceType: 'module', globals: globals.node },
    rules: { 'no-undef': 'error', 'no-unused-vars': ['error', { argsIgnorePattern: '^_', caughtErrors: 'none' }],
      'no-unreachable': 'error', 'no-constant-condition': ['error', { checkLoops: false }], 'no-dupe-keys': 'error', 'constructor-super': 'error' } },
  { files: ['**/*.cjs'], languageOptions: { sourceType: 'commonjs' } },
  { files: ['webview/**/*.{js,jsx}', 'test/webview/**/*.{js,jsx}', 'src/shared/**/*.js', 'src/domain/**/*.js'], languageOptions: { globals: globals.browser, parserOptions: { ecmaFeatures: { jsx: true } } } },
  { files: ['webview/**/*.jsx','test/webview/**/*.jsx'], languageOptions: { globals: { acquireVsCodeApi: 'readonly' } }, rules: { 'no-unused-vars': 'off' } },
  { files: ['src/domain/**/*.js'], rules: { 'no-restricted-imports': ['error', { patterns: ['vscode', 'react', 'react/*', 'ssh2', 'node:*', '../adapters/*', '../vscode/*', '../application/*'] }] } },
];
