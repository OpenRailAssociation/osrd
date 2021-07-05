import React from 'react';
import PropTypes from 'prop-types';
import { Source, Layer } from 'react-map-gl';

const circle = {
  type: 'circle',
  paint: {
    'circle-color': '#ffffff',
    'circle-opacity': 1,
    'circle-radius': 4,
    'circle-stroke-color': '#0088ce',
    'circle-stroke-width': 3,
  },
};

const SearchMarker = (props) => {
  const { geojson } = props;
  return (
    <Source type="geojson" data={geojson}>
      <Layer {...circle} />
    </Source>
  );
};

SearchMarker.propTypes = {
  geojson: PropTypes.object.isRequired,
};

export default SearchMarker;
