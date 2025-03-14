module.exports = function generateBasePostcssConfig(
  tailwindConfigRelativePath = './tailwind.config.js'
) {
  return {
    plugins: {
      'postcss-import': {},
      'postcss-assets': {},
      'tailwindcss/nesting': {},
      tailwindcss: { config: tailwindConfigRelativePath },
      autoprefixer: {},
      'postcss-preset-env': {
        features: { 'nesting-rules': false },
      },
    },
  };
};
