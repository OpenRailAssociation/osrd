import { type StyleSpecification } from '@maplibre/maplibre-gl-style-spec';
import { type LayerProps } from 'react-map-gl';

import { type SourceDefinition } from '../core/types';

export const PATH_SHORT = 'nantes-ancenis';
export const PATH_MEDIUM = 'nantes-angers';
export const PATH_LONG = 'nantes-marseille';
export const PATH_EXTRA_LONG = 'nantes-copenhagen';
export const PATH_NAMES = [PATH_SHORT, PATH_MEDIUM, PATH_LONG, PATH_EXTRA_LONG];

export const OSM_URL = 'https://osm.osrd.fr/data/v3.json';

export const OSM_LAYERS: (LayerProps & { id: string; 'source-layer': string })[] = [
  {
    id: 'water',
    type: 'fill',
    source: 'openmaptiles',
    'source-layer': 'water',
    filter: ['all', ['!=', 'brunnel', 'tunnel']],
    paint: { 'fill-color': 'rgb(158,189,255)' },
  },
  {
    id: 'road_secondary_tertiary_casing',
    type: 'line',
    source: 'openmaptiles',
    'source-layer': 'transportation',
    filter: [
      'all',
      ['!in', 'brunnel', 'bridge', 'tunnel'],
      ['in', 'class', 'secondary', 'tertiary'],
      ['!=', 'ramp', 1],
    ],
    layout: {
      'line-cap': 'round',
      'line-join': 'round',
      visibility: 'visible',
    },
    paint: {
      'line-color': '#e9ac77',
      'line-width': {
        base: 1.2,
        stops: [
          [8, 1.5],
          [20, 17],
        ],
      },
    },
  },
  {
    id: 'road_trunk_primary_casing',
    type: 'line',
    source: 'openmaptiles',
    'source-layer': 'transportation',
    filter: ['all', ['!in', 'brunnel', 'bridge', 'tunnel'], ['in', 'class', 'primary', 'trunk']],
    layout: { 'line-join': 'round', visibility: 'visible' },
    paint: {
      'line-color': '#e9ac77',
      'line-width': {
        base: 1.2,
        stops: [
          [5, 0.4],
          [6, 0.7],
          [7, 1.75],
          [20, 22],
        ],
      },
    },
  },
  {
    id: 'road_motorway',
    type: 'line',
    source: 'openmaptiles',
    'source-layer': 'transportation',
    minzoom: 5,
    filter: [
      'all',
      ['!in', 'brunnel', 'bridge', 'tunnel'],
      ['==', 'class', 'motorway'],
      ['!=', 'ramp', 1],
    ],
    layout: {
      'line-cap': 'round',
      'line-join': 'round',
      visibility: 'visible',
    },
    paint: {
      'line-color': {
        base: 1,
        stops: [
          [5, 'hsl(26, 87%, 62%)'],
          [6, '#fc8'],
        ],
      },
      'line-width': {
        base: 1.2,
        stops: [
          [5, 0],
          [7, 1],
          [20, 18],
        ],
      },
    },
  },
  {
    id: 'road_major_rail',
    type: 'line',
    source: 'openmaptiles',
    'source-layer': 'transportation',
    filter: ['all', ['!in', 'brunnel', 'bridge', 'tunnel'], ['==', 'class', 'rail']],
    layout: { visibility: 'visible' },
    paint: {
      'line-color': '#bbb',
      'line-width': {
        base: 1.4,
        stops: [
          [14, 0.4],
          [15, 0.75],
          [20, 2],
        ],
      },
    },
  },
  {
    id: 'road_major_rail_hatching',
    type: 'line',
    source: 'openmaptiles',
    'source-layer': 'transportation',
    filter: ['all', ['!in', 'brunnel', 'bridge', 'tunnel'], ['==', 'class', 'rail']],
    layout: { visibility: 'visible' },
    paint: {
      'line-color': '#bbb',
      'line-dasharray': [0.2, 8],
      'line-width': {
        base: 1.4,
        stops: [
          [14.5, 0],
          [15, 3],
          [20, 8],
        ],
      },
    },
  },
  {
    id: 'road_transit_rail',
    type: 'line',
    source: 'openmaptiles',
    'source-layer': 'transportation',
    filter: ['all', ['!in', 'brunnel', 'bridge', 'tunnel'], ['==', 'class', 'transit']],
    layout: { visibility: 'visible' },
    paint: {
      'line-color': '#bbb',
      'line-width': {
        base: 1.4,
        stops: [
          [14, 0.4],
          [15, 0.75],
          [20, 2],
        ],
      },
    },
  },
  {
    id: 'road_transit_rail_hatching',
    type: 'line',
    source: 'openmaptiles',
    'source-layer': 'transportation',
    filter: ['all', ['!in', 'brunnel', 'bridge', 'tunnel'], ['==', 'class', 'transit']],
    layout: { visibility: 'visible' },
    paint: {
      'line-color': '#bbb',
      'line-dasharray': [0.2, 8],
      'line-width': {
        base: 1.4,
        stops: [
          [14.5, 0],
          [15, 3],
          [20, 8],
        ],
      },
    },
  },
  {
    id: 'water_name_line',
    type: 'symbol',
    source: 'openmaptiles',
    'source-layer': 'waterway',
    filter: ['all', ['==', '$type', 'LineString']],
    layout: {
      'text-field': '{name}',
      'text-font': ['Roboto Regular'],
      'text-max-width': 5,
      'text-size': 12,
      'symbol-placement': 'line',
    },
    paint: {
      'text-color': '#5d60be',
      'text-halo-color': 'rgba(255,255,255,0.7)',
      'text-halo-width': 1,
    },
  },
  {
    id: 'water_name_point',
    type: 'symbol',
    source: 'openmaptiles',
    'source-layer': 'water_name',
    filter: ['==', '$type', 'Point'],
    layout: {
      'text-field': '{name}',
      'text-font': ['Roboto Regular'],
      'text-max-width': 5,
      'text-size': 12,
    },
    paint: {
      'text-color': '#5d60be',
      'text-halo-color': 'rgba(255,255,255,0.7)',
      'text-halo-width': 1,
    },
  },
  {
    id: 'poi_z16',
    type: 'symbol',
    source: 'openmaptiles',
    'source-layer': 'poi',
    minzoom: 16,
    filter: ['all', ['==', '$type', 'Point'], ['>=', 'rank', 20]],
    layout: {
      'icon-image': [
        'match',
        ['get', 'subclass'],
        ['florist', 'furniture'],
        ['get', 'subclass'],
        ['get', 'class'],
      ],
      'text-anchor': 'top',
      'text-field': '{name}',
      'text-font': ['Roboto Condensed Italic'],
      'text-max-width': 9,
      'text-offset': [0, 0.6],
      'text-size': 12,
    },
    paint: {
      'text-color': '#666',
      'text-halo-blur': 0.5,
      'text-halo-color': '#ffffff',
      'text-halo-width': 1,
    },
  },
  {
    id: 'poi_z15',
    type: 'symbol',
    source: 'openmaptiles',
    'source-layer': 'poi',
    minzoom: 15,
    filter: ['all', ['==', '$type', 'Point'], ['>=', 'rank', 7], ['<', 'rank', 20]],
    layout: {
      'icon-image': [
        'match',
        ['get', 'subclass'],
        ['florist', 'furniture'],
        ['get', 'subclass'],
        ['get', 'class'],
      ],
      'text-anchor': 'top',
      'text-field': '{name}',
      'text-font': ['Roboto Condensed Italic'],
      'text-max-width': 9,
      'text-offset': [0, 0.6],
      'text-size': 12,
    },
    paint: {
      'text-color': '#666',
      'text-halo-blur': 0.5,
      'text-halo-color': '#ffffff',
      'text-halo-width': 1,
    },
  },
  {
    id: 'poi_z14',
    type: 'symbol',
    source: 'openmaptiles',
    'source-layer': 'poi',
    minzoom: 14,
    filter: ['all', ['==', '$type', 'Point'], ['>=', 'rank', 1], ['<', 'rank', 7]],
    layout: {
      'icon-image': [
        'match',
        ['get', 'subclass'],
        ['florist', 'furniture'],
        ['get', 'subclass'],
        ['get', 'class'],
      ],
      'text-anchor': 'top',
      'text-field': '{name}',
      'text-font': ['Roboto Condensed Italic'],
      'text-max-width': 9,
      'text-offset': [0, 0.6],
      'text-size': 12,
    },
    paint: {
      'text-color': '#666',
      'text-halo-blur': 0.5,
      'text-halo-color': '#ffffff',
      'text-halo-width': 1,
    },
  },
  {
    id: 'poi_transit',
    type: 'symbol',
    source: 'openmaptiles',
    'source-layer': 'poi',
    filter: ['all', ['in', 'class', 'bus', 'rail', 'airport']],
    layout: {
      'icon-image': '{class}',
      'text-anchor': 'left',
      'text-field': '{name_en}',
      'text-font': ['Roboto Condensed Italic'],
      'text-max-width': 9,
      'text-offset': [0.9, 0],
      'text-size': 12,
    },
    paint: {
      'text-color': '#4898ff',
      'text-halo-blur': 0.5,
      'text-halo-color': '#ffffff',
      'text-halo-width': 1,
    },
  },
  {
    id: 'road_label',
    type: 'symbol',
    source: 'openmaptiles',
    'source-layer': 'transportation_name',
    filter: ['all'],
    layout: {
      'symbol-placement': 'line',
      'text-anchor': 'center',
      'text-field': '{name}',
      'text-font': ['Roboto Regular'],
      'text-offset': [0, 0.15],
      'text-size': {
        base: 1,
        stops: [
          [13, 12],
          [14, 13],
        ],
      },
    },
    paint: {
      'text-color': '#765',
      'text-halo-blur': 0.5,
      'text-halo-width': 1,
    },
  },
  {
    id: 'road_shield',
    type: 'symbol',
    source: 'openmaptiles',
    'source-layer': 'transportation_name',
    minzoom: 7,
    filter: ['all', ['<=', 'ref_length', 6]],
    layout: {
      'icon-image': 'default_{ref_length}',
      'icon-rotation-alignment': 'viewport',
      'symbol-placement': 'point',
      'symbol-spacing': 500,
      'text-field': '{ref}',
      'text-font': ['Roboto Regular'],
      'text-offset': [0, 0.1],
      'text-rotation-alignment': 'viewport',
      'text-size': 10,
      'icon-size': 0.8,
    },
  },
  {
    id: 'place_other',
    type: 'symbol',
    source: 'openmaptiles',
    'source-layer': 'place',
    filter: [
      'all',
      ['in', 'class', 'hamlet', 'island', 'islet', 'neighbourhood', 'suburb', 'quarter'],
    ],
    layout: {
      'text-field': '{name_en}',
      'text-font': ['Roboto Condensed Italic'],
      'text-letter-spacing': 0.1,
      'text-max-width': 9,
      'text-size': {
        base: 1.2,
        stops: [
          [12, 10],
          [15, 14],
        ],
      },
      'text-transform': 'uppercase',
    },
    paint: {
      'text-color': '#633',
      'text-halo-color': 'rgba(255,255,255,0.8)',
      'text-halo-width': 1.2,
    },
  },
  {
    id: 'place_village',
    type: 'symbol',
    source: 'openmaptiles',
    'source-layer': 'place',
    filter: ['all', ['==', 'class', 'village']],
    layout: {
      'text-field': '{name_en}',
      'text-font': ['Roboto Regular'],
      'text-max-width': 8,
      'text-size': {
        base: 1.2,
        stops: [
          [10, 12],
          [15, 22],
        ],
      },
    },
    paint: {
      'text-color': '#333',
      'text-halo-color': 'rgba(255,255,255,0.8)',
      'text-halo-width': 1.2,
    },
  },
  {
    id: 'place_town',
    type: 'symbol',
    source: 'openmaptiles',
    'source-layer': 'place',
    filter: ['all', ['==', 'class', 'town']],
    layout: {
      'icon-image': {
        base: 1,
        stops: [
          [0, 'dot_9'],
          [8, ''],
        ],
      },
      'text-anchor': 'bottom',
      'text-field': '{name_en}',
      'text-font': ['Roboto Regular'],
      'text-max-width': 8,
      'text-offset': [0, 0],
      'text-size': {
        base: 1.2,
        stops: [
          [7, 12],
          [11, 16],
        ],
      },
    },
    paint: {
      'text-color': '#333',
      'text-halo-color': 'rgba(255,255,255,0.8)',
      'text-halo-width': 1.2,
    },
  },
  {
    id: 'place_city',
    type: 'symbol',
    source: 'openmaptiles',
    'source-layer': 'place',
    minzoom: 5,
    filter: ['all', ['==', 'class', 'city']],
    layout: {
      'icon-image': {
        base: 1,
        stops: [
          [0, 'dot_9'],
          [8, ''],
        ],
      },
      'text-anchor': 'bottom',
      'text-field': '{name_en}',
      'text-font': ['Roboto Medium'],
      'text-max-width': 8,
      'text-offset': [0, 0],
      'text-size': {
        base: 1.2,
        stops: [
          [7, 14],
          [11, 24],
        ],
      },
      'icon-allow-overlap': true,
      'icon-optional': false,
    },
    paint: {
      'text-color': '#333',
      'text-halo-color': 'rgba(255,255,255,0.8)',
      'text-halo-width': 1.2,
    },
  },
  {
    id: 'state',
    type: 'symbol',
    source: 'openmaptiles',
    'source-layer': 'place',
    maxzoom: 6,
    filter: ['all', ['==', 'class', 'state']],
    layout: {
      'text-field': '{name_en}',
      'text-font': ['Roboto Condensed Italic'],
      'text-size': {
        stops: [
          [4, 11],
          [6, 15],
        ],
      },
      'text-transform': 'uppercase',
    },
    paint: {
      'text-color': '#633',
      'text-halo-color': 'rgba(255,255,255,0.7)',
      'text-halo-width': 1,
    },
  },
  {
    id: 'country_3',
    type: 'symbol',
    source: 'openmaptiles',
    'source-layer': 'place',
    filter: ['all', ['>=', 'rank', 3], ['==', 'class', 'country']],
    layout: {
      'text-field': '{name_en}',
      'text-font': ['Roboto Condensed Italic'],
      'text-max-width': 6.25,
      'text-size': {
        stops: [
          [3, 11],
          [7, 17],
        ],
      },
      'text-transform': 'none',
    },
    paint: {
      'text-color': '#334',
      'text-halo-blur': 1,
      'text-halo-color': 'rgba(255,255,255,0.8)',
      'text-halo-width': 1,
    },
  },
  {
    id: 'country_2',
    type: 'symbol',
    source: 'openmaptiles',
    'source-layer': 'place',
    filter: ['all', ['==', 'rank', 2], ['==', 'class', 'country']],
    layout: {
      'text-field': '{name_en}',
      'text-font': ['Roboto Condensed Italic'],
      'text-max-width': 6.25,
      'text-size': {
        stops: [
          [2, 11],
          [5, 17],
        ],
      },
      'text-transform': 'none',
    },
    paint: {
      'text-color': '#334',
      'text-halo-blur': 1,
      'text-halo-color': 'rgba(255,255,255,0.8)',
      'text-halo-width': 1,
    },
  },
  {
    id: 'country_1',
    type: 'symbol',
    source: 'openmaptiles',
    'source-layer': 'place',
    filter: ['all', ['==', 'rank', 1], ['==', 'class', 'country']],
    layout: {
      'text-field': '{name_en}',
      'text-font': ['Roboto Condensed Italic'],
      'text-max-width': 6.25,
      'text-size': {
        stops: [
          [1, 11],
          [4, 17],
        ],
      },
      'text-transform': 'none',
    },
    paint: {
      'text-color': '#334',
      'text-halo-blur': 1,
      'text-halo-color': 'rgba(255,255,255,0.8)',
      'text-halo-width': 1,
    },
  },
  {
    id: 'continent',
    type: 'symbol',
    source: 'openmaptiles',
    'source-layer': 'place',
    maxzoom: 1,
    filter: ['all', ['==', 'class', 'continent']],
    layout: {
      'text-field': '{name_en}',
      'text-font': ['Roboto Condensed Italic'],
      'text-size': 13,
      'text-transform': 'uppercase',
      'text-justify': 'center',
    },
    paint: {
      'text-color': '#633',
      'text-halo-color': 'rgba(255,255,255,0.7)',
      'text-halo-width': 1,
    },
  },
];

export const OSM_SOURCE: SourceDefinition = {
  id: 'osm',
  url: OSM_URL,
  layers: OSM_LAYERS,
};

export const OSM_BASE_MAP_STYLE: StyleSpecification = {
  version: 8,
  name: 'Blank',
  sources: {
    openmaptiles: {
      type: 'vector',
      url: 'https://osm.osrd.fr/data/v3.json',
    },
  },
  sprite: 'https://maputnik.github.io/osm-liberty/sprites/osm-liberty',
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
