import React from 'react';
import PropTypes from 'prop-types';
import { useSelector } from 'react-redux';
import { Source, Layer } from 'react-map-gl';
import { MAP_URL } from 'common/Map/const';

export default function OperationalPoints(props) {
  const { layersSettings } = useSelector((state) => state.map);
  const { infraID } = useSelector((state) => state.osrdconf);
  const { geomType } = props;
  const layerPoint = {
    type: 'circle',
    'source-layer': 'operational_points',
    paint: {
      'circle-stroke-color': '#82be00',
      'circle-stroke-width': 3,
      'circle-color': 'rgba(255, 255, 255, 0)',
      'circle-radius': 5,
    },
  };

  const layerName = {
    type: 'symbol',
    'source-layer': 'operational_points',
    layout: {
      'text-field': '{name}',
      'text-font': [
        'Roboto Condensed',
      ],
      'text-size': 12,
      'text-anchor': 'left',
      'text-allow-overlap': false,
      'text-ignore-placement': false,
      'text-offset': [0.75, 0.10],
      visibility: 'visible',
    },
    paint: {
      'text-color': '#202258',
      'text-halo-width': 2,
      'text-halo-color': 'rgba(255,255,255,0.75)',
      'text-halo-blur': 1,
    },
  };

  return layersSettings.operationalpoints && (
    <Source
      id={`osrd_operational_point_${geomType}`}
      type="vector"
      url={`${MAP_URL}/layer/operational_points/mvt/${geomType}/?version=${infraID}`}
    >
      <Layer {...layerPoint} id={`chartis/osrd_operational_point/${geomType}`} />
      <Layer {...layerName} id={`chartis/osrd_operational_point_name/${geomType}`} />
    </Source>
  );
}

OperationalPoints.propTypes = {
  geomType: PropTypes.string.isRequired,
};
