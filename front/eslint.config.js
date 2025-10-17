import js from '@eslint/js';
import importPlugin from 'eslint-plugin-import';
import jsxA11yPlugin from 'eslint-plugin-jsx-a11y';
import prettierPluginRecommended from 'eslint-plugin-prettier/recommended';
import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';
import vitestPlugin from '@vitest/eslint-plugin';

export default [
  {
    files: ['**/*.ts', '**/*.tsx', '**/*.js'],
  },
  {
    ignores: [
      'src/common/api/generatedEditoastApi.ts',
      'src/common/api/osrdGatewayApi.ts',
      'public',
      'build',
      'playwright-report',
      'ui',
    ],
  },
  ...tseslint.config(js.configs.recommended, ...tseslint.configs.recommended),
  prettierPluginRecommended,
  importPlugin.flatConfigs.recommended,
  importPlugin.flatConfigs.typescript,
  reactPlugin.configs.flat.recommended,
  reactHooksPlugin.configs['recommended-latest'],
  vitestPlugin.configs.recommended,
  jsxA11yPlugin.flatConfigs.recommended,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
        ecmaVersion: 'latest',
      },
    },
    settings: {
      react: {
        version: 'detect',
      },
      'import/resolver': {
        node: {
          paths: ['src'],
          moduleDirectory: ['node_modules', 'src'],
        },
        typescript: true, // uses eslint-import-resolver-typescript
      },
    },
    rules: {
      'import/no-named-as-default': 'off',
      'import/no-named-as-default-member': 'off',
      'react-hooks/exhaustive-deps': 'off',
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
      '@typescript-eslint/consistent-type-definitions': ['error', 'type'],
      '@typescript-eslint/consistent-type-imports': ['error', { fixStyle: 'inline-type-imports' }],
      '@typescript-eslint/no-shadow': 'error',
      '@typescript-eslint/no-use-before-define': 'error',
      '@typescript-eslint/no-unnecessary-type-assertion': 'error',
      '@typescript-eslint/no-unsafe-return': 'error',
      '@typescript-eslint/no-unsafe-call': 'error',
      '@typescript-eslint/non-nullable-type-assertion-style': 'error',

      '@typescript-eslint/no-restricted-types': [
        'error',
        {
          types: {
            LegacyFilterSpecification: {
              message: 'Use ExpressionFilterSpecification instead',
              fixWith: 'ExpressionFilterSpecification',
            },
            'React.FC':
              'Useless and has some drawbacks, see https://github.com/facebook/create-react-app/pull/8177',
            FC: 'Useless and has some drawbacks, see https://github.com/facebook/create-react-app/pull/8177',
            'React.FunctionComponent':
              'Useless and has some drawbacks, see https://github.com/facebook/create-react-app/pull/8177',
            'React.FunctionalComponent':
              'Preact specific, useless and has some drawbacks, see https://github.com/facebook/create-react-app/pull/8177',
          },
        },
      ],
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
            'tests/**',
            'scripts/**',
            'playwright.config.ts',
            'vite.config.ts',
          ],
        },
      ],
      'jsx-a11y/click-events-have-key-events': 'off',
      'linebreak-style': ['error', 'unix'],
      'no-await-in-loop': 'off',
      'no-console': ['error', { allow: ['info', 'debug', 'warn', 'error'] }],
      'no-continue': 'off',
      'no-named-as-default': 'off',
      'no-param-reassign': 'off',
      'no-use-before-define': 'off',
      'no-restricted-syntax': 'off',
      'prettier/prettier': ['warn'],
      'react/forbid-prop-types': 'off',
      'react/jsx-filename-extension': 'off',
      'react/jsx-no-useless-fragment': 'error',
      'react/jsx-props-no-spreading': 0,
      'react/jsx-uses-react': 'off',
      'react/react-in-jsx-scope': 'off',
      'react/prefer-stateless-function': 'off',
      'react/static-property-placement': 0,
      // disable vitest/prefer-to-be because it does not authorize toEqual for the floats
      'vitest/prefer-to-be': 'off',
      'no-restricted-imports': [
        'error',
        {
          name: 'common/api/generatedEditoastApi',
          message: 'Please use common/api/osrdEditoastApi instead',
        },
      ],

      '@typescript-eslint/no-explicit-any': 2,
      '@typescript-eslint/explicit-module-boundary-types': 0,
      '@typescript-eslint/space-before-blocks': 0,
      camelcase: 0,
      'no-nonoctal-decimal-escape': 0,
      'no-param-reassign': 0,
      'no-unsafe-optional-chaining': 0,
      'object-curly-newline': 0,
      'react/function-component-definition': 0,
      'react/jsx-props-no-spreading': 0,
      'react/no-array-index-key': 0,
      'react/require-default-props': 0,

      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  {
    files: ['tests/**/*.ts', 'tests/**/*.tsx'],
    rules: {
      '@typescript-eslint/no-floating-promises': 'error',
      'react-hooks/rules-of-hooks': 'off',
    },
  },
];
