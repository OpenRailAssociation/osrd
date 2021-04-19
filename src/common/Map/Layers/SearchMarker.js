import React from 'react';
import PropTypes from 'prop-types';
import { Marker } from 'react-map-gl';

const SearchMarker = (props) => {
  const { data, colors } = props;

  return (
    <Marker
      className="map-search-marker"
      longitude={data.lonlat[0]}
      latitude={data.lonlat[1]}
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
        <circle style={{ fill: '#0088ce', fillOpacity: '0.5' }} cx="16" cy="16" r="16" />
      </svg>
      <span className="map-search-marker-title">{ data.title }</span>
    </Marker>
  );
};

SearchMarker.propTypes = {
  colors: PropTypes.object.isRequired,
  data: PropTypes.object.isRequired,
};

export default SearchMarker;
