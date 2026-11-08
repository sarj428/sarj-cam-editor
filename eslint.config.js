import js from '@eslint/js';

export default [
  js.configs.recommended,
  {
    ignores: ['dist/**', 'node_modules/**']
  },
  {
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'module',
      globals: {
        window: 'readonly',
        document: 'readonly',
        console: 'readonly',
        URL: 'readonly',
        Blob: 'readonly',
        File: 'readonly',
        FileReader: 'readonly',
        MediaRecorder: 'readonly',
        requestAnimationFrame: 'readonly',
        cancelAnimationFrame: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        prompt: 'readonly',
        confirm: 'readonly',
        alert: 'readonly',
        indexedDB: 'readonly',
        IDBDatabase: 'readonly',
        IDBRequest: 'readonly',
        IDBOpenDBRequest: 'readonly',
        HTMLCanvasElement: 'readonly',
        HTMLVideoElement: 'readonly',
        HTMLElement: 'readonly',
        Element: 'readonly',
        NodeListOf: 'readonly',
        KeyboardEvent: 'readonly',
        performance: 'readonly',
        NodeFilter: 'readonly',
        IntersectionObserver: 'readonly'
      }
    },
    rules: {
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-console': ['warn', { allow: ['log', 'warn', 'error'] }]
    }
  }
];
