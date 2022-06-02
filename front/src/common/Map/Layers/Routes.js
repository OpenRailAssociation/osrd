import { Layer, Source } from 'react-map-gl';

import { MAP_URL } from 'common/Map/const';
import PropTypes from 'prop-types';
import React from 'react';
import { useSelector } from 'react-redux';

export default function Routes(props) {
  const { layersSettings } = useSelector((state) => state.map);
  const { infraID } = useSelector((state) => state.osrdconf);
  const { geomType, colors } = props;

  const line = {
    type: 'line',
    'source-layer': 'routes',
    minzoom: 6,
    maxzoom: 24,
    layout: {
      visibility: 'visible',
      // 'line-cap': 'round',
      // 'line-join': 'miter',
    },
    paint: {
      'line-color': '#e05206',
      'line-width': 1,
      'line-offset': 4,
      'line-opacity': 1,
      'line-dasharray': [1, 2],
    },
  };

  const point = {
    type: 'circle',
    'source-layer': 'routes',
    paint: {
      'circle-stroke-color': 'rgba(255, 182, 18, 0.5)',
      'circle-color': 'rgba(255, 182, 18, 0.5)',
      'circle-radius': 4,
    },
  };

  const text = {
    type: 'symbol',
    'source-layer': 'routes',
    minzoom: 9,
    maxzoom: 24,
    layout: {
      visibility: 'visible',
      'text-font': ['Roboto Bold'],
      'symbol-placement': 'line-center',
      'text-field': ['slice', ['get', 'id'], 6],
      'text-size': 12,
      'text-justify': 'center',
      'text-allow-overlap': true,
      'text-ignore-placement': true,
      'text-offset': [0, -0.5],
    },
    paint: {
      'text-color': colors.routes.text,
      'text-halo-color': colors.routes.halo,
      'text-halo-width': 1,
      'text-opacity': 1,
    },
  };

  return layersSettings.routes ? (
    <Source
      id={`osrd_routes_${geomType}`}
      type="vector"
      url={`${MAP_URL}/layer/routes/mvt/${geomType}/?infra=${infraID}`}
    >
      <Layer
        {...line}
        id={`chartis/osrd_routes_line/${geomType}`}
      />
      <Layer
        {...point}
        id={`chartis/osrd_routes_point/${geomType}`}
      />
      <Layer
        {...text}
        id={`chartis/osrd_routes_text/${geomType}`}
      />
    </Source>
  ) : null;
}

Routes.propTypes = {
  geomType: PropTypes.string.isRequired,
  colors: PropTypes.object.isRequired,
};
