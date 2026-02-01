import gts from 'gts';
import globals from 'globals';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import vitest from '@vitest/eslint-plugin';
import playwright from 'eslint-plugin-playwright';

const vitestGlobals = {
  afterAll: 'readonly',
  afterEach: 'readonly',
  beforeAll: 'readonly',
  beforeEach: 'readonly',
  describe: 'readonly',
  expect: 'readonly',
  it: 'readonly',
  test: 'readonly',
  vi: 'readonly',
};

const wxtGlobals = {
  browser: 'readonly',
  chrome: 'readonly',
};

export default [
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'test-results/**',
      '.wxt/**',
      '.output/**',
      '.agents/**',
      'build/**',
      'eslint.config.js',
      '*.config.js',
    ],
  },
  ...gts,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.es2021,
        ...wxtGlobals,
      },
    },
    plugins: {
      react,
      'react-hooks': reactHooks,
      'jsx-a11y': jsxA11y,
    },
    settings: {
      react: {version: 'detect'},
    },
    rules: {
      ...react.configs.recommended.rules,
      ...reactHooks.configs.recommended.rules,
      ...jsxA11y.configs.recommended.rules,
      'react/react-in-jsx-scope': 'off',
      'n/no-unsupported-features/node-builtins': 'off',
      'n/no-missing-import': 'off',
      'n/no-unpublished-import': 'off',
    },
  },
  {
    files: ['**/*.spec.{ts,tsx}', '**/*.test.{ts,tsx}'],
    plugins: {vitest},
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.es2021,
        ...vitestGlobals,
        ...wxtGlobals,
      },
    },
    rules: {
      ...vitest.configs.recommended.rules,
    },
  },
  {
    files: ['test/**/*.ts'],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.es2021,
        ...vitestGlobals,
        ...wxtGlobals,
      },
    },
  },
  {
    files: ['tests/**/*.ts'],
    plugins: {playwright},
    rules: {
      ...playwright.configs.recommended.rules,
    },
  },
  {
    files: [
      'tests/**/*.ts',
      'scripts/**/*.{js,ts,mjs,cjs}',
      '*.{config,conf}.{js,ts,mjs,cjs}',
      'vitest.config.ts',
      'wxt.config.ts',
      'playwright.config.ts',
    ],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.es2021,
      },
    },
    rules: {
      'react-hooks/rules-of-hooks': 'off',
      'react-hooks/exhaustive-deps': 'off',
    },
  },
  {
    files: [
      'entrypoints/background.ts',
      'entrypoints/offscreen/**/*.{ts,tsx}',
      'entrypoints/test-activate/**/*.{ts,tsx}',
    ],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: ['@/utils/dom/**'],
        },
      ],
    },
  },
];
