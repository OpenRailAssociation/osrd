import React from 'react';
import PropTypes from 'prop-types';
import { useSelector } from 'react-redux';
import { Source, Layer } from 'react-map-gl';
import { MAP_URL } from 'common/Map/const';

export default function SpeedLimitsColors(props) {
  const { layersSettings } = useSelector((state) => state.map);
  const { infraID } = useSelector((state) => state.osrdconf);
  const { geomType } = props;

  const speedLineParams = {
    type: 'line',
    'source-layer': 'speed_sections',
    minzoom: 6,
    maxzoom: 24,
    layout: {
      visibility: 'visible',
      'line-cap': 'round',
      'line-join': 'miter',
    },
    paint: {
      'line-color': ['case',
        ['all', ['>', ['round', ['*', 3.6, ['get', 'speed']]], 220]], 'rgba(145, 211, 255, 1)',
        ['all', ['>', ['round', ['*', 3.6, ['get', 'speed']]], 160], ['<=', ['to-number', ['get', 'speed']], 220]], 'rgba(137, 247, 216, 1)',
        ['all', ['>=', ['round', ['*', 3.6, ['get', 'speed']]], 140], ['<=', ['to-number', ['get', 'speed']], 160]], 'rgba(158, 255, 119, 1)',
        ['all', ['>=', ['round', ['*', 3.6, ['get', 'speed']]], 100], ['<', ['to-number', ['get', 'speed']], 140]], 'rgba(224, 254, 100, 1)',
        ['all', ['>', ['round', ['*', 3.6, ['get', 'speed']]], 60], ['<', ['to-number', ['get', 'speed']], 100]], 'rgba(253, 244, 121, 1)',
        ['all', ['<=', ['round', ['*', 3.6, ['get', 'speed']]], 60], ['>', ['to-number', ['get', 'speed']], 30]], 'rgba(251, 178, 134, 1)',
        ['all', ['<=', ['round', ['*', 3.6, ['get', 'speed']]], 30]], 'rgba(239, 81, 81, 1)',
        'rgba(185, 185, 185, 1)',
      ],
      'line-width': 4,
      'line-offset': 0,
      'line-opacity': 1,
    },
  };

  return layersSettings.speedlimitscolor && (
    <Source
      id={`osrd_speed_limit_${geomType}`}
      type="vector"
      url={`${MAP_URL}/layer/speed_sections/mvt/${geomType}/?version=${infraID}`}
    >
      <Layer
        {...speedLineParams}
        id={`chartis/osrd_speed_limit_colors/${geomType}`}
        beforeId={`chartis/osrd_speed_limit_points/${geomType}`}
      />
    </Source>
  );
}

SpeedLimitsColors.propTypes = {
  geomType: PropTypes.string.isRequired,
};
