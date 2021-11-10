const osmBlankStyle = {
  version: 8,
  name: 'Blank',
  sources: { },
  sprite: 'https://static.osm.osrd.fr/sprites/sprites',
  glyphs: 'https://static.osm.osrd.fr/fonts/{fontstack}/{range}.pbf',
  layers: [
    {
      id: 'emptyBackground',
      type: 'background',
      layout: {
        visibility: 'visible',
      },
    },
  ],
  id: 'blank',
};

export default osmBlankStyle;
