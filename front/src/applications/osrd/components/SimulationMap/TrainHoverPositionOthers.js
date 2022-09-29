import { Marker } from 'react-map-gl';
import PropTypes from 'prop-types';
import React from 'react';
import nextId from 'react-id-generator';

const TrainHoverPositionOthers = (props) => {
  const { trainHoverPositionOthers } = props;
  return trainHoverPositionOthers.map((point, headIndex) => {
    const tail =
      point.properties.intermediaterMarkersPoints &&
      point.properties.intermediaterMarkersPoints.map((intermediateMarkerPoint) => (
        <TrainSection
          longitude={intermediateMarkerPoint.geometry.coordinates[0]}
          latitude={intermediateMarkerPoint.geometry.coordinates[1]}
          fill="#333"
          fillOpacity="0.60"
          key={nextId()}
        />
      ));
    return (
      <>
        <TrainSection
          longitude={point.geometry.coordinates[0]}
          latitude={point.geometry.coordinates[1]}
          fill="#333"
          fillOpacity="0.75"
          label={
            <>
              <small>{point.properties.name}</small>
              <span className="small ml-1 font-weight-bold text-muted">
                {Math.round(point.properties.speed)}
                km/h
              </span>
            </>
          }
          key={nextId()}
        />
        {tail}
      </>
    );
  });
};

TrainHoverPositionOthers.propTypes = {
  trainHoverPositionOthers: PropTypes.array.isRequired,
};

export default TrainHoverPositionOthers;
