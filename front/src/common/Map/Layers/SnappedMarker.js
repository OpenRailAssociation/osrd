import React from 'react';
import PropTypes from 'prop-types';
import { Marker } from 'react-map-gl';

const SearchMarker = (props) => {
  const { geojson } = props;
  return (
    <Marker
      className="map-search-marker"
      longitude={geojson.geometry.coordinates[0]}
      latitude={geojson.geometry.coordinates[1]}
      captureClick={false}
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32" style={{ cursor: 'pointer' }}>
        <circle style={{ fill: '#0088ce' }} cx="16" cy="16" r="6" />
        <circle style={{ fill: '#ffffff' }} cx="16" cy="16" r="4" />
      </svg>
    </Marker>
  );
};

SearchMarker.propTypes = {
  geojson: PropTypes.object.isRequired,
};

export default SearchMarker;
