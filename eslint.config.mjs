import js from '@eslint/js';
import globals from 'globals';

export default [
  js.configs.recommended,
  {
    files: ['mdac-filler.user.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'script',
      globals: {
        ...globals.browser,
        GM_getValue: 'readonly',
        GM_setValue: 'readonly',
        unsafeWindow: 'readonly',
      },
    },
    rules: {
      'no-unused-vars': ['error', { args: 'none' }],
    },
  },
  {
    ignores: ['reference/**', 'node_modules/**'],
  },
];
