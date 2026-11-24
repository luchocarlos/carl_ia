import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import tseslint from 'typescript-eslint';

// Configuración de ESLint (formato "flat config").
export default tseslint.config(
  // Carpetas que no se analizan
  {
    ignores: ['dist', 'playwright-report', 'test-results', 'node_modules'],
  },
  // Código de la app (navegador, React + TypeScript)
  {
    files: ['src/**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser, // window, document, localStorage…
      parserOptions: {
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    plugins: {
      'react-hooks': reactHooks,
      'react-refresh': reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules, // reglas de hooks (dependencias, orden de llamadas)
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }], // mantiene funcional el HMR
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }, // los nombres con "_" se permiten sin usar
      ],
      '@typescript-eslint/no-explicit-any': 'error', // prohíbe `any`
    },
  },
  // Archivos de configuración y tests e2e (se ejecutan en Node)
  {
    files: ['*.config.{js,ts}', 'e2e/**/*.ts'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.node,
      parserOptions: { sourceType: 'module' },
    },
  },
);
