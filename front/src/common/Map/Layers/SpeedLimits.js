import React from 'react';
import PropTypes from 'prop-types';
import { useSelector } from 'react-redux';
import { Source, Layer } from 'react-map-gl';
import { MAP_URL } from 'common/Map/const';

export default function SpeedLimits(props) {
  const { layersSettings } = useSelector((state) => state.map);
  const { infraID } = useSelector((state) => state.osrdconf);
  const { geomType, colors } = props;

  const speedValuePointParams = {
    type: 'symbol',
    'source-layer': 'speed_sections',
    minzoom: 9,
    maxzoom: 24,
    layout: {
      visibility: 'visible',
      'text-font': ['Roboto Bold'],
      'symbol-placement': 'point',
      'text-field': ['to-string', ['round', ['*', 3.6, ['get', 'speed']]]],
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
    filter: ['all', ['has', 'speed']],
    layout: {
      visibility: 'visible',
      'text-font': ['Roboto Bold'],
      'symbol-placement': 'line',
      'text-field': ['concat', ['round', ['*', 3.6, ['get', 'speed']]], 'km/h'],
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

  return layersSettings.speedlimits && (
    <Source
      id={`osrd_speed_limit_${geomType}`}
      type="vector"
      url={`${MAP_URL}/layer/speed_sections/mvt/${geomType}/?version=${infraID}`}
    >
      <Layer {...speedValuePointParams} id={`chartis/osrd_speed_limit_points/${geomType}`} />
      <Layer {...speedValueParams} id={`chartis/osrd_speed_limit_value/${geomType}`} />
    </Source>
  );
}

SpeedLimits.propTypes = {
  geomType: PropTypes.string.isRequired,
  colors: PropTypes.object.isRequired,
};
