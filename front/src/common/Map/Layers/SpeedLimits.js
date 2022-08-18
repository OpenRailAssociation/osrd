import { Layer, Source } from 'react-map-gl';

import { MAP_URL } from 'common/Map/const.ts';
import PropTypes from 'prop-types';
import React from 'react';
import { useSelector } from 'react-redux';

export default function SpeedLimits(props) {
  const { layersSettings } = useSelector((state) => state.map);
  const { infraID } = useSelector((state) => state.osrdconf);
  const { geomType, colors } = props;
  const tag = `"${layersSettings.speedlimittag}"`;
  const uglyJSONParsingOfSpeedLimitByTags = ['round', ['*', 3.6, ['case',
    ['!=', ['index-of', ['literal', tag], ['get', 'speed_limit_by_tag']], -1],
    ['to-number', ['slice', ['get', 'speed_limit_by_tag'],
      ['+',
        ['+',
          ['index-of', ['literal', tag], ['get', 'speed_limit_by_tag']],
          tag.length,
        ],
        2,
      ],
      ['+',
        ['+',
          ['index-of', ['literal', tag], ['get', 'speed_limit_by_tag']],
          tag.length,
        ],
        8,
      ],
    ]],
    ['to-number', ['get', 'speed_limit']],
  ]]];
  const speedSectionFilter = ['all', ['has', 'speed_limit'], ['>', uglyJSONParsingOfSpeedLimitByTags, 0]];

  const speedValuePointParams = {
    type: 'symbol',
    'source-layer': 'speed_sections',
    minzoom: 9,
    maxzoom: 24,
    filter: speedSectionFilter,
    layout: {
      visibility: 'visible',
      'text-font': ['Roboto Bold'],
      'symbol-placement': 'point',
      'text-field': ['to-string', uglyJSONParsingOfSpeedLimitByTags],
      'text-size': 12,
      'icon-allow-overlap': false,
      'icon-ignore-placement': false,
      'text-justify': 'left',
      'text-allow-overlap': false,
      'text-ignore-placement': false,
    },
    paint: {
      'text-color': colors.speed.pointtext,
      'text-halo-color': colors.speed.pointhalo,
      'text-halo-width': 5,
      'text-opacity': 1,
    },
  };

  const speedValueParams = {
    type: 'symbol',
    'source-layer': 'speed_sections',
    minzoom: 9,
    maxzoom: 24,
    filter: speedSectionFilter,
    layout: {
      visibility: 'visible',
      'text-font': ['Roboto Bold'],
      'symbol-placement': 'line',
      'text-field': ['concat', uglyJSONParsingOfSpeedLimitByTags, 'km/h'],
      'text-size': 9,
      'text-justify': 'left',
      'text-allow-overlap': false,
      'text-ignore-placement': false,
    },
    paint: {
      'text-color': colors.speed.text,
      'text-halo-color': colors.speed.halo,
      'text-halo-width': 1,
      'text-opacity': 1,
    },
  };

  const speedLineParams = {
    type: 'line',
    'source-layer': 'speed_sections',
    minzoom: 6,
    maxzoom: 24,
    filter: speedSectionFilter,
    layout: {
      visibility: 'visible',
      'line-cap': 'round',
      'line-join': 'miter',
    },
    paint: {
      'line-color':
      ['let', 'speed_limit', uglyJSONParsingOfSpeedLimitByTags,
        ['case',
          ['all', ['>', ['var', 'speed_limit'], 220]], 'rgba(145, 211, 255, 1)',
          ['all', ['>', ['var', 'speed_limit'], 160], ['<=', ['var', 'speed_limit'], 220]], 'rgba(137, 247, 216, 1)',
          ['all', ['>=', ['var', 'speed_limit'], 140], ['<=', ['var', 'speed_limit'], 160]], 'rgba(158, 255, 119, 1)',
          ['all', ['>=', ['var', 'speed_limit'], 100], ['<', ['var', 'speed_limit'], 140]], 'rgba(224, 254, 100, 1)',
          ['all', ['>', ['var', 'speed_limit'], 60], ['<', ['var', 'speed_limit'], 100]], 'rgba(253, 244, 121, 1)',
          ['all', ['<=', ['var', 'speed_limit'], 60], ['>', ['var', 'speed_limit'], 30]], 'rgba(251, 178, 134, 1)',
          ['all', ['<=', ['var', 'speed_limit'], 30]], 'rgba(239, 81, 81, 1)',
          'rgba(185, 185, 185, 1)',
        ],
      ],
      'line-width': 4,
      'line-offset': 0,
      'line-opacity': 1,
    },
  };

  return layersSettings.speedlimits && (
    <Source
      id={`osrd_speed_limit_${geomType}`}
      type="vector"
      url={`${MAP_URL}/layer/speed_sections/mvt/${geomType}/?infra=${infraID}`}
    >
      <Layer {...speedValuePointParams} id={`chartis/osrd_speed_limit_points/${geomType}`} />
      <Layer {...speedValueParams} id={`chartis/osrd_speed_limit_value/${geomType}`} />
      <Layer
        {...speedLineParams}
        id={`chartis/osrd_speed_limit_colors/${geomType}`}
        beforeId={`chartis/osrd_speed_limit_points/${geomType}`}
      />
    </Source>
  );
}

SpeedLimits.propTypes = {
  geomType: PropTypes.string.isRequired,
  colors: PropTypes.object.isRequired,
};
