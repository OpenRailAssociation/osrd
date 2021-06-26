import React from 'react';
import PropTypes from 'prop-types';
import nextId from 'react-id-generator';
import { Marker } from 'react-map-gl';
import { sec2time } from 'utils/timeManipulation';

const TrainHoverPositionOthers = (props) => {
  const { trainHoverPositionOthers } = props;

  return trainHoverPositionOthers.map((point) => (
    <Marker
      className="map-search-marker"
      longitude={point.geo_position[0]}
      latitude={point.geo_position[1]}
      key={nextId()}
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
        <circle style={{ fill: '#333', fillOpacity: '0.75' }} cx="16" cy="16" r="8" />
      </svg>
      <small>{point.name}</small>
      <span className="small ml-1 font-weight-bold text-muted">
        {Math.round(point.speed * 3.6)}
        km/h
      </span>
    </Marker>
  ));
};

TrainHoverPositionOthers.propTypes = {
  trainHoverPositionOthers: PropTypes.array.isRequired,
};

export default TrainHoverPositionOthers;
