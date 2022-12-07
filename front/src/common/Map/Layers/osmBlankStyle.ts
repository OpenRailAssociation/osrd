import { MapProps } from 'react-map-gl';

const osmBlankStyle: MapProps['mapStyle'] = {
  version: 8,
  name: 'Blank',
  sources: {},
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
};

export default osmBlankStyle;
