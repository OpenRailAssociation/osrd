import React from 'react';
import { useSelector } from 'react-redux';
import PropTypes from 'prop-types';
import cx from 'classnames';
import nextId from 'react-id-generator';

import { datetime2time } from 'utils/timeManipulation';
import TrainSection from './TrainSection';

function getFill(isSelectedTrain, ecoBlocks) {
  if (isSelectedTrain) {
    return ecoBlocks ? '#82be00' : '#303383';
  }
  return '#333';
}

function getLabel(isSelectedTrain, ecoBlocks, point) {
  if (isSelectedTrain) {
    return (
      <>
        <span
          className={cx('small', 'font-weight-bold', ecoBlocks ? 'text-secondary' : 'text-primary')}
        >
          {Math.round(point?.properties?.speedTime?.speed ?? 0)}
          km/h
        </span>
        <span className="ml-2 small">
          {point.properties.speedTime && datetime2time(point.properties.speedTime.time)}
        </span>
      </>
    );
  }
  return (
    <>
      <small>{point.properties.name}</small>
      <span className="small ml-1 font-weight-bold text-muted">
        {Math.round(point.properties.speed)}
        km/h
      </span>
    </>
  );
}

function TrainHoverPosition(props) {
  const { point, isSelectedTrain } = props;
  const { selectedTrain, allowancesSettings } = useSelector((state) => state.osrdsimulation);
  const simulation = useSelector((state) => state.osrdsimulation.simulation.present);
  const trainID = simulation.trains[selectedTrain].id;
  const { ecoBlocks } = allowancesSettings[trainID];
  const fill = getFill(isSelectedTrain, ecoBlocks);
  const label = getLabel(isSelectedTrain, ecoBlocks, point);
  const tail =
    point.properties.intermediaterMarkersPoints &&
    point.properties.intermediaterMarkersPoints.map((intermediateMarkerPoint, i) => (
      <TrainSection
        longitude={intermediateMarkerPoint.geometry.coordinates[0]}
        latitude={intermediateMarkerPoint.geometry.coordinates[1]}
        fill={fill}
        fillOpacity="0.60"
        key={nextId()}
      />
    ));
  return (
    <>
      <TrainSection
        longitude={point.geometry?.coordinates[0]}
        latitude={point.geometry?.coordinates[1]}
        fill={fill}
        fillOpacity="0.75"
        label={label}
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
