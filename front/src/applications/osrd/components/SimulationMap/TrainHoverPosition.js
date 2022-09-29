import React from 'react';
import { useSelector } from 'react-redux';
import PropTypes from 'prop-types';
import { Marker } from 'react-map-gl';
import cx from 'classnames';
import nextId from 'react-id-generator';

import { datetime2time } from 'utils/timeManipulation';

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

function TrainHoverPosition(props) {
  const { point, isSelectedTrain } = props;
  const { selectedTrain, allowancesSettings } = useSelector((state) => state.osrdsimulation);
  const simulation = useSelector((state) => state.osrdsimulation.simulation.present);
  const trainID = simulation.trains[selectedTrain].id;
  const tail =
    point.properties.intermediaterMarkersPoints &&
    point.properties.intermediaterMarkersPoints.map((intermediateMarkerPoint, i) => (
      <TrainSection
        longitude={intermediateMarkerPoint.geometry.coordinates[0]}
        latitude={intermediateMarkerPoint.geometry.coordinates[1]}
        fill={allowancesSettings[trainID].ecoBlocks ? '#82be00' : '#303383'}
        fillOpacity="0.60"
        key={nextId()}
      />
    ));
  return (
    <>
      <TrainSection
        longitude={point.geometry?.coordinates[0]}
        latitude={point.geometry?.coordinates[1]}
        fill={allowancesSettings[trainID].ecoBlocks ? '#82be00' : '#303383'}
        fillOpacity="0.75"
        label={
          <>
            <span
              className={cx(
                'small',
                'font-weight-bold',
                allowancesSettings[trainID]?.ecoBlocks ? 'text-secondary' : 'text-primary'
              )}
            >
              {Math.round(point?.properties?.speedTime?.speed ?? 0)}
              km/h
            </span>
            <span className="ml-2 small">
              {point.properties.speedTime && datetime2time(point.properties.speedTime.time)}
            </span>
          </>
        }
      />
      {tail}
    </>
  );
}

TrainHoverPosition.propTypes = {
  point: PropTypes.object.isRequired,
  isSelectedTrain: PropTypes.bool,
};

TrainHoverPosition.defaultProps = {
  isSelectedTrain: false,
};

export default TrainHoverPosition;
