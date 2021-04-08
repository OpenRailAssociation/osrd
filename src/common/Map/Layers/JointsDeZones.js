import React from 'react';
import PropTypes from 'prop-types';
import { Source, Layer } from 'react-map-gl';
import { MAP_URL } from 'common/Map/const';

const JointsDeZones = (props) => {
  const { geomType } = props;
  const angleName = geomType === 'sch' ? 'angleSch' : 'angleGeo';
  const layerdef = {
    type: 'symbol',
    minzoom: 12,
    'source-layer': 'map_midi_jointdezone',
    layout: {
      'text-field': '{RA_libelle}',
      'text-font': [
        'Roboto Condensed',
      ],
      'text-size': 10,
      'text-offset': [2, 0],
      'icon-image': 'JDZB',
      'icon-size': 0.1,
      'text-anchor': 'center',
      'icon-rotation-alignment': 'map',
      'icon-rotate': ['get', angleName],
      'text-rotate': ['get', angleName],
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

  return (
    <Source
      id={`map_midi_jointdezone_${geomType}`}
      type="vector"
      url={`${MAP_URL}/chartis/layer/map_midi_jointdezone/mvt/${geomType}/`}
    >
      <Layer {...layerdef} />
    </Source>
  );
};

JointsDeZones.propTypes = {
  geomType: PropTypes.string.isRequired,
};

export default JointsDeZones;
