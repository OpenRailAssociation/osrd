import React from 'react';
import { useSelector } from 'react-redux';
import { Layer, Source } from 'react-map-gl';
import lineSlice from '@turf/line-slice';
import { Position, Feature, LineString } from 'geojson';
import cx from 'classnames';

import { RootState } from 'reducers';
import { datetime2time } from 'utils/timeManipulation';

interface TrainPosition {
  headPosition: Position;
  tailPosition: Position;
  speedTime: {
    speed: number;
    time: number;
  };
}

function getFill(isSelectedTrain: boolean, ecoBlocks) {
  if (isSelectedTrain) {
    return ecoBlocks ? '#82be00' : '#303383';
  }
  return '#333';
}

function getLabel(isSelectedTrain, ecoBlocks, point: TrainPosition) {
  if (isSelectedTrain) {
    return (
      <>
        <span
          className={cx('small', 'font-weight-bold', ecoBlocks ? 'text-secondary' : 'text-primary')}
        >
          {Math.round(point?.speedTime?.speed ?? 0)}
          km/h
        </span>
        <span className="ml-2 small">{point.speedTime && datetime2time(point.speedTime.time)}</span>
      </>
    );
  }
  return (
    <>
      {/* <small>{point.properties.name}</small> */}
      <span className="small ml-1 font-weight-bold text-muted">
        {Math.round(point.speedTime.speed)}
        km/h
      </span>
    </>
  );
}

interface TrainHoverPositionProps {
  point: TrainPosition;
  isSelectedTrain: boolean;
  geojsonPath: Feature<LineString>;
}

function TrainHoverPosition(props: TrainHoverPositionProps) {
  const { point, isSelectedTrain, geojsonPath } = props;
  const { selectedTrain, allowancesSettings } = useSelector(
    (state: RootState) => state.osrdsimulation
  );
  const simulation = useSelector((state: RootState) => state.osrdsimulation.simulation.present);
  const trainID = simulation.trains[selectedTrain].id;
  const { ecoBlocks } = allowancesSettings[trainID];
  const fill = getFill(isSelectedTrain, ecoBlocks);
  const label = getLabel(isSelectedTrain, ecoBlocks, point);

  const trainGeoJsonPath =
    point.headPosition &&
    point.tailPosition &&
    lineSlice(point.headPosition, point.tailPosition, geojsonPath);
  return (
    <Source type="geojson" data={trainGeoJsonPath}>
      <Layer
        id="trainPath"
        type="line"
        paint={{
          'line-width': 8,
          'line-color': fill,
        }}
      />
    </Source>
  );
}

export default TrainHoverPosition;
