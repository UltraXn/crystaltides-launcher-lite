import reactConfig from '@crystaltides/eslint-config/react';
import globals from 'globals';

/** @type {import('eslint').Linter.Config[]} */
export default [
  {
    ignores: [
      'dist/**',
      'dist-package/**',
      'node_modules/**',
      'src-tauri/target/**',
      'coverage/**',
      '*.cjs',
      '*.log',
      'scripts/**',
    ],
  },
  ...reactConfig,
  {
    files: ['src/**/*.{ts,tsx,js,jsx}'],
    languageOptions: {
      globals: {
        ...globals.browser,
      },
    },
    rules: {
      // ⚛️ React 19 & Desktop Vite SPA
      'no-empty': ['warn', { allowEmptyCatch: true }],
      'better-tailwindcss/no-unknown-classes': 'off',
      'better-tailwindcss/no-concatenated-classes': 'warn',
      'react-doctor/no-unguarded-browser-global-in-render-or-hook-init': 'off',
      'react-doctor/effect-needs-cleanup': 'warn',
      'react-doctor/no-impure-state-updater': 'warn',
      'react-doctor/no-layout-property-animation': 'warn',
      'react-doctor/only-export-components': 'off',
      'react-doctor/no-create-object-url-without-revoke': 'warn',

      // 🔍 SonarJS / SonarLint (Calibración Desktop SPA)
      'sonarjs/cognitive-complexity': ['warn', 15],
      'sonarjs/no-duplicate-string': ['warn', { threshold: 5 }],
      'sonarjs/no-nested-functions': 'warn',
      'sonarjs/no-nested-conditional': 'warn',
      'sonarjs/super-linear-regex': 'warn',
      'sonarjs/concise-regex': 'warn',
      'sonarjs/no-identical-functions': 'warn',
      'sonarjs/no-redundant-assignments': 'warn',
      'sonarjs/no-all-duplicated-branches': 'warn',
      'sonarjs/no-clear-text-protocols': 'warn',

      // 🛡️ Regexp & Security (Avisos preventivos sin bloquear build)
      'regexp/prefer-w': 'warn',
      'regexp/no-unused-capturing-group': 'warn',
      'regexp/use-ignore-case': 'warn',
      'security/detect-unsafe-regex': 'warn',
      'security/detect-non-literal-regexp': 'warn',
      'security/detect-non-literal-fs-filename': 'off',
    },
  },
  {
    files: [
      'src/**/__tests__/**/*.{ts,tsx}',
      'src/**/*.{test,spec}.{ts,tsx}',
    ],
    rules: {
      'sonarjs/no-duplicate-string': 'off',
      'sonarjs/cognitive-complexity': 'off',
      'sonarjs/no-identical-functions': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
];
