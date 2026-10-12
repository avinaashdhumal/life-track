// ESLint flat config (Expo defaults: React, React Hooks, import rules, TypeScript).
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const globals = require('globals');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['android/*', 'ios/*', 'dist/*', '.expo/*', 'node_modules/*']
  },
  {
    rules: {
      // i18next and twrnc document calling methods on their default instance (i18n.changeLanguage,
      // tw.style); this rule flags exactly that usage.
      'import/no-named-as-default-member': 'off'
    }
  },
  {
    // Node scripts (tests runner, i18n checks, config plugin)
    files: ['**/*.cjs', '**/*.mjs', 'scripts/**'],
    languageOptions: {
      globals: globals.node
    }
  },
  {
    files: ['**/*.cjs'],
    languageOptions: {
      sourceType: 'commonjs'
    }
  }
]);
