import js from '@eslint/js';
import globals from 'globals';

export default [
  { ignores: ['node_modules/**', 'js/lib/**'] },
  js.configs.recommended,
  {
    files: ['js/**/*.js', 'portal/**/*.js'],
    languageOptions: { ecmaVersion: 'latest', sourceType: 'module', globals: { ...globals.browser } },
    rules: { 'no-empty': ['error', { allowEmptyCatch: true }] },
  },
  {
    files: ['sw.js'],
    languageOptions: { ecmaVersion: 'latest', sourceType: 'script', globals: { ...globals.serviceworker, ...globals.browser } },
    rules: { 'no-empty': ['error', { allowEmptyCatch: true }] },
  },
  {
    files: ['scripts/**/*.mjs'],
    languageOptions: { ecmaVersion: 'latest', sourceType: 'module', globals: { ...globals.node } },
  },
];
