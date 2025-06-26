module.exports = {
  multipass: true,
  plugins: [
    'preset-default',
    'removeStyleElement',
    {
      name: 'removeAttrs',
      params: {
        attrs: [
          'xmlns:xlink',
          'id',
          'class',
          'data-name',
          'fill',
          'transform',
          'href',
          'clip-path',
          'clip-rule',
        ],
      },
    },
  ],
};
