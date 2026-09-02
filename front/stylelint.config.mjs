/** @type {import("stylelint").Config} */
export default {
  extends: ['stylelint-config-standard-scss'],
  // Here are the set of rules we have disabled; our aim is still to enable all or nearly all of them
  // soon enough; we just want to do it progressively so it's reviewable.
  rules: {
    // Write rgb(255 255 255 / 0.2) instead of rgba(255, 255, 255, 0.2)
    'alpha-value-notation': null,
    'color-function-alias-notation': null,
    'color-function-notation': null,

    // Write '#fff' instead of '#ffffff'
    'color-hex-length': null,

    // Always follow a coherent case pattern for our class names, property names, mixins, etc.
    'custom-property-pattern': null,
    'keyframes-name-pattern': null,
    'selector-class-pattern': null,
    'scss/at-mixin-pattern': null,
    'scss/dollar-variable-pattern': null,

    // Don't use redundant, too specific properties (e.g. row-gap and column-gap vs. gap)
    'declaration-block-no-redundant-longhand-properties': null,

    // Always use modern media query ranges (e.g. width < 80rem vs. max-width: 80rem)
    'media-feature-range-notation': null,

    // Write margin: 1px instead of margin: 1px 1px 1px 1px
    'shorthand-property-no-redundant-values': null,

    // Don't use @extend with class names (we should use percent-placeholders instead)
    'scss/at-extend-no-missing-placeholder': null,

    // Don't call mixins without arguments but with parentheses
    'scss/at-mixin-argumentless-call-parentheses': null,

    // Don't use at-rules unknown to standard SCSS (i.e. @theme)
    'scss/at-rule-no-unknown': null,

    // Incompatible with oxfmt's formatting configuration
    'scss/dollar-variable-colon-space-after': null,
    'scss/operator-no-newline-after': null,
  },
};
