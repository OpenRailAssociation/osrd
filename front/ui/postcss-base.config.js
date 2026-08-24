export default {
  plugins: {
    '@tailwindcss/postcss': {},
    'postcss-assets': {
      relative: 'true',
    },
    'postcss-preset-env': {
      features: { 'nesting-rules': false },
    },
  },
};
