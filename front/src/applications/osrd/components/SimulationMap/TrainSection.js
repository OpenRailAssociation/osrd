import React from 'react';
import PropTypes from 'prop-types';
import { Marker } from 'react-map-gl';

function TrainSection({ longitude, latitude, fill, fillOpacity, label }) {
  return (
    <Marker className="map-search-marker" longitude={longitude} latitude={latitude}>
      <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
        <circle
          style={{
            fill,
            fillOpacity,
          }}
          cx="16"
          cy="16"
          r="8"
        />
      </svg>
      {label}
    </Marker>
  );
}

TrainSection.propTypes = {
  longitude: PropTypes.number.isRequired,
  latitude: PropTypes.number.isRequired,
  fill: PropTypes.string.isRequired,
  fillOpacity: PropTypes.string.isRequired,
  label: PropTypes.oneOfType([PropTypes.arrayOf(PropTypes.node), PropTypes.node]),
};

TrainSection.defaultProps = {
  label: null,
};

export default TrainSection;
