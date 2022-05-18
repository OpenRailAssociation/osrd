import React from 'react';
import PropTypes from 'prop-types';
import { useSelector } from 'react-redux';
import { Source, Layer } from 'react-map-gl';
import { MAP_URL } from 'common/Map/const';

const BufferStops = (props) => {
  const { layersSettings } = useSelector((state) => state.map);
  const { infraID } = useSelector((state) => state.osrdconf);
  const { geomType, colors } = props;
  const layerdef = {
    type: 'symbol',
    minzoom: 12,
    'source-layer': 'buffer_stops',
    layout: {
      'text-field': '{id}',
      'text-font': [
        'Roboto Condensed',
      ],
      'text-size': 10,
      'text-offset': [0, 1.2],
      'icon-image': 'HEURTOIR',
      'icon-size': 0.2,
      'text-anchor': 'center',
      'icon-rotation-alignment': 'viewport',
      'icon-allow-overlap': false,
      'icon-ignore-placement': false,
      'text-allow-overlap': false,
      visibility: 'visible',
    },
    paint: {
      'text-color': '#555',
      'text-halo-width': 2,
      'text-halo-color': 'rgba(255,255,255,0.75)',
      'text-halo-blur': 1,
    },
  };

  return layersSettings.bufferstops ? (
    <Source
      id={`osrd_bufferstoplayer_${geomType}`}
      type="vector"
      url={`${MAP_URL}/layer/buffer_stops/mvt/${geomType}/?infra=${infraID}`}
    >
      <Layer {...layerdef} id={`chartis/osrd_bufferstoplayer/${geomType}`} />
    </Source>
  ) : null;
};

BufferStops.propTypes = {
  geomType: PropTypes.string.isRequired,
  colors: PropTypes.object.isRequired,
};

export default BufferStops;
