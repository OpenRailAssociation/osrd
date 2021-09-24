import React from 'react';
import PropTypes from 'prop-types';
import { Marker } from 'react-map-gl';
import { datetime2time } from 'utils/timeManipulation';

const TrainHoverPosition = (props) => {
  const { point } = props;

  return (
    <Marker
      className="map-search-marker"
      longitude={point.geometry.coordinates[0]}
      latitude={point.geometry.coordinates[1]}
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
        <circle style={{ fill: '#e05206', fillOpacity: '0.75' }} cx="16" cy="16" r="8" />
      </svg>
      <span className="small font-weight-bold text-orange">
        {point.properties && Math.round(point.properties.speed)}
        km/h
      </span>
      <span className="ml-2 small">
        {point.properties && datetime2time(point.properties.time)}
      </span>
    </Marker>
  );
};

TrainHoverPosition.propTypes = {
  point: PropTypes.object.isRequired,
};

export default TrainHoverPosition;
