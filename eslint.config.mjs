import js from '@eslint/js';
import globals from 'globals';

export default [
    { ignores: ['node_modules/**', '*.vsix'] },
    js.configs.recommended,
    {
        files: ['**/*.js'],
        languageOptions: { ecmaVersion: 2022, sourceType: 'commonjs', globals: { ...globals.node } },
        rules: { 'no-unused-vars': ['warn', { caughtErrors: 'none' }] }
    },
    {
        files: ['media/**/*.js'],
        languageOptions: { sourceType: 'script', globals: { ...globals.browser, acquireVsCodeApi: 'readonly' } }
    }
];
