export default {
  plugins: {
    '@tailwindcss/postcss': {},
    'postcss-assets': {},
    'postcss-preset-env': {
      features: { 'nesting-rules': false },
    },
  },
};
