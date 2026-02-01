import js from '@eslint/js';
import globals from 'globals';

export default [
  {
    ignores: ['dist/', 'node_modules/'],
  },
  js.configs.recommended,
  {
    files: ['src/**/*.js'],
    languageOptions: {
      globals: globals.browser,
      ecmaVersion: 2022,
      sourceType: 'module',
    },
    rules: {
      'no-console': 'off'
    }
  },
  {
    files: ['tests/**/*.js'],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.es2021,
        ...globals.jest
      },
      ecmaVersion: 2022,
      sourceType: 'module',
    },
  }
  ,
  {
    files: ['scripts/**/*.js'],
    languageOptions: {
      globals: globals.node,
      ecmaVersion: 2022,
      sourceType: 'module',
    },
    rules: {
      'no-console': 'off'
    }
  }
];
