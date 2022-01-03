import React from 'react';
import PropTypes from 'prop-types';
import { useSelector } from 'react-redux';
import { Source, Layer } from 'react-map-gl';
import { MAP_URL } from 'common/Map/const';

export default function SignalingType(props) {
  const { layersSettings } = useSelector((state) => state.map);
  const { infraID } = useSelector((state) => state.osrdconf);
  const { geomType } = props;
  const layerdef = {
    type: 'symbol',
    'source-layer': 'signaling_sections',
    layout: {
      'text-font': [
        'Roboto Condensed',
      ],
      'symbol-placement': 'line',
      'text-field': '{signaling_type}',
      'text-size': 10,
      'text-offset': [0, -1],
    },
    paint: {
      'text-color': '#333',
      'text-halo-width': 2,
      'text-halo-color': '#fff',
      'text-halo-blur': 1,
    },
  };

  return layersSettings.signalingtype && (
    <Source
      id={`osrd_signaling_type_${geomType}`}
      type="vector"
      url={`${MAP_URL}/layer/signaling_sections/mvt/${geomType}/?version=${infraID}`}
    >
      <Layer {...layerdef} id={`chartis/osrd_signaling_type/${geomType}`} />
    </Source>
  );
}

SignalingType.propTypes = {
  geomType: PropTypes.string.isRequired,
};
