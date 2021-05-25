module.exports = {
  env: {
    browser: true,
    es6: true,
    jest: true,
  },
  extends: [
    'airbnb',
    'plugin:react/recommended',
  ],
  globals: {
    Atomics: 'readonly',
    SharedArrayBuffer: 'readonly',
  },
  parserOptions: {
    ecmaFeatures: {
      jsx: true,
    },
    ecmaVersion: 2018,
    sourceType: 'module',
  },
  plugins: [
    'react',
    'babel',
    'react-hooks',
    'only-warn',
  ],
  parser: 'babel-eslint',
  rules: {
    "react/prefer-stateless-function": "off",
    "react/jsx-filename-extension": "off",
    "no-param-reassign": "off",
    "no-console": "off",
    "global-require": "off",
    "react/forbid-prop-types": "off",
    "no-named-as-default": "off",
    "react/jsx-props-no-spreading": 0,
    "react/static-property-placement": 0,
    "import/no-extraneous-dependencies": 0,
    "linebreak-style": ["error", "unix"],
    "jsx-a11y/click-events-have-key-events": "off",
  },
  settings: {
    "import/resolver": {
      node: {
        paths: ["src"]
      }
    }
  }
};
