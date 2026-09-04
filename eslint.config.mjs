import js from '@eslint/js';
import globals from 'globals';

export default [
  js.configs.recommended,
  {
    files: ['mdac-filler.user.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
      // Tampermonkey globals are declared by the /* global */ directive in the script
      // itself, so any eslint config (including super-linter's default) accepts them.
      globals: { ...globals.browser },
    },
    rules: {
      'no-unused-vars': ['error', { args: 'none' }],
    },
  },
  {
    ignores: ['reference/**', 'node_modules/**'],
  },
];
