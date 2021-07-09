import React from 'react';
import PropTypes from 'prop-types';
import { Marker } from 'react-map-gl';
import { sec2time } from 'utils/timeManipulation';

const TrainHoverPosition = (props) => {
  const { point } = props;

  return (
    <Marker
      className="map-search-marker"
      longitude={point.geo_position[0]}
      latitude={point.geo_position[1]}
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
        <circle style={{ fill: '#e05206', fillOpacity: '0.75' }} cx="16" cy="16" r="8" />
      </svg>
      <span className="small font-weight-bold text-orange">
        {Math.round(point.speed * 3.6)}
        km/h
      </span>
      <span className="ml-2 small">
        {sec2time(point.time)}
      </span>
    </Marker>
  );
};

TrainHoverPosition.propTypes = {
  point: PropTypes.object.isRequired,
};

export default TrainHoverPosition;
