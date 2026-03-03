import { join } from 'node:path';

import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import importPlugin from 'eslint-plugin-import';
import prettierPluginRecommended from 'eslint-plugin-prettier/recommended';
import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';
import { configs as storybookPluginConfigs } from 'eslint-plugin-storybook';
import { configs as tsEslintConfigs } from 'typescript-eslint';

export default defineConfig([
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js'],
  },
  globalIgnores(['**/ui-icons/src/**', '**/dist/**', '**/storybook-static/**']),
  js.configs.recommended,
  tsEslintConfigs.recommended,
  prettierPluginRecommended,
  importPlugin.flatConfigs.recommended,
  importPlugin.flatConfigs.typescript,
  reactPlugin.configs.flat.recommended,
  reactHooksPlugin.configs.flat.recommended,
  storybookPluginConfigs['flat/recommended'],
  {
    languageOptions: {
      parserOptions: {
        tsconfigRootDir: import.meta.dirname,
        ecmaVersion: 'latest',
      },
    },
    settings: {
      react: {
        version: 'detect',
      },
      'import/resolver': {
        typescript: true, // uses eslint-import-resolver-typescript
      },
    },
    rules: {
      'import/order': [
        'error',
        {
          groups: ['builtin', 'external', 'internal'],

          pathGroups: [
            {
              pattern: 'react',
              group: 'builtin',
              position: 'before',
            },
          ],

          pathGroupsExcludedImportTypes: ['react'],
          'newlines-between': 'always',

          alphabetize: {
            order: 'asc',
            caseInsensitive: true,
          },
        },
      ],

      'no-shadow': 'off',

      '@typescript-eslint/consistent-type-imports': [
        'error',
        {
          fixStyle: 'inline-type-imports',
        },
      ],
      '@typescript-eslint/no-shadow': 'error',
      '@typescript-eslint/no-use-before-define': 'error',
      '@typescript-eslint/no-explicit-any': 2,
      '@typescript-eslint/explicit-module-boundary-types': 0,
      '@typescript-eslint/space-before-blocks': 0,
      '@typescript-eslint/no-restricted-types': [
        'error',
        {
          types: {
            LegacyFilterSpecification: {
              message: 'Use ExpressionFilterSpecification instead',
              fixWith: 'ExpressionFilterSpecification',
            },

            FC: 'Useless and has some drawbacks, see https://github.com/facebook/create-react-app/pull/8177',
            'React.FC':
              'Useless and has some drawbacks, see https://github.com/facebook/create-react-app/pull/8177',
            'React.FunctionComponent':
              'Useless and has some drawbacks, see https://github.com/facebook/create-react-app/pull/8177',
            'React.FunctionalComponent':
              'Preact specific, useless and has some drawbacks, see https://github.com/facebook/create-react-app/pull/8177',
          },
        },
      ],
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          argsIgnorePattern: '^_',
        },
      ],

      camelcase: 0,
      'no-nonoctal-decimal-escape': 0,
      'no-unsafe-optional-chaining': 0,
      'object-curly-newline': 0,
      'react/function-component-definition': 0,
      'react/no-array-index-key': 0,
      'react/require-default-props': 0,
      'arrow-body-style': ['error', 'as-needed'],
      'global-require': 'off',

      'import/extensions': [
        'error',
        'ignorePackages',
        {
          js: 'never',
          jsx: 'never',
          ts: 'never',
          tsx: 'never',
        },
      ],

      'import/no-extraneous-dependencies': [
        'error',
        {
          devDependencies: [
            '**/*.spec.ts',
            '**/__tests__/**',
            '**/.storybook/**',
            '**/build.js',
            '**/vitest.config.mts',
            '**/rollup.config.js',
            'rollup-base.config.js',
            'eslint.config.js',
          ],
        },
      ],

      'import/no-unresolved': [
        2,
        {
          commonjs: true,
          amd: true,
        },
      ],

      'jsx-a11y/click-events-have-key-events': 'off',
      'linebreak-style': ['error', 'unix'],

      'no-console': [
        'error',
        {
          allow: ['info', 'debug', 'warn', 'error'],
        },
      ],

      'no-named-as-default': 'off',
      'no-param-reassign': 0,
      'no-use-before-define': 'off',
      'prettier/prettier': ['warn'],
      'react/forbid-prop-types': 'off',
      'react/jsx-filename-extension': 'off',
      'react/jsx-no-useless-fragment': 'error',
      'react/jsx-props-no-spreading': 0,
      'react/prefer-stateless-function': 'off',
      'react/static-property-placement': 0,
      'no-restricted-imports': [
        'error',
        {
          patterns: ['@osrd-project/*/src/*', '*/ui-*/src/*'],
        },
      ],
    },
  },
  {
    basePath: import.meta.dirname,
    files: ['./eslint.config.js', './rollup-base.config.js'],
    extends: [
      {
        rules: {
          'import/no-extraneous-dependencies': [
            'error',
            {
              devDependencies: true,
              packageDir: [join(import.meta.dirname, './base')],
            },
          ],
        },
      },
    ],
  },
]);
