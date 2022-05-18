import React from 'react';
import PropTypes from 'prop-types';
import { useSelector } from 'react-redux';
import { Source, Layer } from 'react-map-gl';
import { MAP_URL } from 'common/Map/const';

export default function Detectors(props) {
  const { layersSettings } = useSelector((state) => state.map);
  const { infraID } = useSelector((state) => state.osrdconf);
  const { geomType, colors } = props;
  const layerPoint = {
    type: 'circle',
    'source-layer': 'detectors',
    paint: {
      'circle-stroke-color': colors.detectors.circle,
      'circle-color': colors.detectors.circle,
      'circle-radius': 3,
    },
  };

  const layerName = {
    type: 'symbol',
    'source-layer': 'detectors',
    layout: {
      'text-field': '{id}',
      'text-font': [
        'Roboto Condensed',
      ],
      'text-size': 10,
      'text-anchor': 'left',
      'text-allow-overlap': false,
      'text-ignore-placement': false,
      'text-offset': [0.75, 0.10],
      visibility: 'visible',
    },
    paint: {
      'text-color': colors.detectors.text,
      'text-halo-width': 1,
      'text-halo-color': colors.detectors.halo,
      'text-halo-blur': 1,
    },
  };

  return layersSettings.detectors ? (
    <Source
      id={`osrd_detectors_${geomType}`}
      type="vector"
      url={`${MAP_URL}/layer/detectors/mvt/${geomType}/?infra=${infraID}`}
    >
      <Layer {...layerPoint} id={`chartis/osrd_detectors/${geomType}`} />
      <Layer {...layerName} id={`chartis/osrd_detectors_name/${geomType}`} />
    </Source>
  ) : null;
}

Detectors.propTypes = {
  geomType: PropTypes.string.isRequired,
  colors: PropTypes.object.isRequired,
};
