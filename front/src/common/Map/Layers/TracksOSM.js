import React from 'react';
import PropTypes from 'prop-types';
import { useSelector } from 'react-redux';
import { Source, Layer } from 'react-map-gl';
import { OSM_URL } from 'common/Map/const';

function TracksOSM(props) {
  const { showOSMtracksections } = useSelector((state) => state.map);
  const { colors } = props;

  const railwayMinor = {
    id: 'railwayMinor',
    type: 'line',
    source: 'openmaptiles',
    'source-layer': 'transportation',
    filter: ['all', ['==', 'class', 'rail'], ['==', 'service', 'yard']],
    layout: {
      visibility: 'visible',
    },
    paint: {
      'line-color': colors.tracksosm.minor,
    },
  };

  const railwayMajor = {
    id: 'railwayMajor',
    type: 'line',
    source: 'openmaptiles',
    'source-layer': 'transportation',
    filter: ['all', ['==', 'class', 'rail'], ['!=', 'service', 'yard']],
    layout: {
      visibility: 'visible',
    },
    paint: {
      'line-color': colors.tracksosm.major,
      'line-width': {
        stops: [
          [15, 1],
          [17, 3],
        ],
      },
    },
  };

  return showOSMtracksections ? (
    <Source id="tracksOSM" type="vector" url={OSM_URL} source-layer="transportation">
      <Layer {...railwayMinor} />
      <Layer {...railwayMajor} />
    </Source>
  ) : null;
}

TracksOSM.propTypes = {
  colors: PropTypes.object.isRequired,
};

export default TracksOSM;
