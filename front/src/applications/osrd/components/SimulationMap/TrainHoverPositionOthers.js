import React from 'react';
import PropTypes from 'prop-types';
import nextId from 'react-id-generator';
import { Marker } from 'react-map-gl';

const TrainHoverPositionOthers = (props) => {
  const { trainHoverPositionOthers } = props;
  return trainHoverPositionOthers.map((point) => (
    <Marker
      className="map-search-marker"
      longitude={point.geometry.coordinates[0]}
      latitude={point.geometry.coordinates[1]}
      key={nextId()}
    >
      <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
        <circle style={{ fill: '#333', fillOpacity: '0.75' }} cx="16" cy="16" r="8" />
      </svg>
      <small>{point.properties.name}</small>
      <span className="small ml-1 font-weight-bold text-muted">
        {Math.round(point.properties.speed)}
        km/h
      </span>
    </Marker>
  ));
};

TrainHoverPositionOthers.propTypes = {
  trainHoverPositionOthers: PropTypes.array.isRequired,
};

export default TrainHoverPositionOthers;
