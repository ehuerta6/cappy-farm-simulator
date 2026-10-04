import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import globals from 'globals';

export default tseslint.config(
  { ignores: ['dist/**', 'node_modules/**', 'public/pyodide/**', 'artifacts/**'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  { files: ['src/**/*.ts'], languageOptions: { globals: globals.browser } },
  { files: ['public/python-worker.js'], languageOptions: { globals: globals.worker } },
  { files: ['scripts/**/*.mjs', '*.js'], languageOptions: { globals: globals.node } },
);
