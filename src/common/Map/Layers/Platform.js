import React from 'react';
import PropTypes from 'prop-types';
import { Source, Layer } from 'react-map-gl';
import { OSM_URL } from 'common/Map/const';

const Platform = (props) => {
  const { colors } = props;

  const platformParams = {
    id: 'platformParams',
    type: 'fill-extrusion',
    source: 'openmaptiles',
    'source-layer': 'transportation',
    filter: [
      'all',
      ['==', '$type', 'Polygon'],
      ['==', 'class', 'path'],
      ['==', 'subclass', 'platform'],
    ],
    paint: {
      'fill-extrusion-color': colors.platform.fill,
      'fill-extrusion-height': 2,
      'fill-extrusion-base': 1,
      'fill-extrusion-opacity': 0.4,
    },
  };

  return (
    <Source
      id="platform"
      type="vector"
      url={OSM_URL}
      source-layer="transportation"
    >
      <Layer {...platformParams} />
    </Source>
  );
};

Platform.propTypes = {
  colors: PropTypes.object.isRequired,
};

export default Platform;
