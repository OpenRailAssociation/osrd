import type { Config } from 'stylelint';

export default {
  extends: ['stylelint-config-standard-scss'],

  // Here are the set of rules we have disabled; our aim is still to enable all or nearly all of them
  // soon enough; we just want to do it progressively so it's reviewable.
  rules: {
    'alpha-value-notation': null,
    'at-rule-no-vendor-prefix': null,
    'color-function-alias-notation': null,
    'color-function-notation': null,
    'color-hex-length': null,
    'custom-property-pattern': null,
    'declaration-block-no-duplicate-properties': null,
    'declaration-block-no-redundant-longhand-properties': null,
    'declaration-block-no-shorthand-property-overrides': null,
    'keyframes-name-pattern': null,
    'media-feature-range-notation': null,
    'property-no-deprecated': null,
    'scss/at-extend-no-missing-placeholder': null,
    'scss/at-mixin-argumentless-call-parentheses': null,
    'scss/at-mixin-pattern': null,
    'scss/at-rule-no-unknown': null,
    'scss/dollar-variable-colon-space-after': null,
    'scss/dollar-variable-pattern': null,
    'scss/load-no-partial-leading-underscore': null,
    'scss/load-partial-extension': null,
    'scss/no-global-function-names': null,
    'scss/operator-no-newline-after': null,
    'selector-class-pattern': null,
    'shorthand-property-no-redundant-values': null,
  },
} satisfies Config;
