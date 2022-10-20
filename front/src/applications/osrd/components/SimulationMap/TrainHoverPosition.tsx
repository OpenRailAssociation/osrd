import React from 'react';
import { useSelector } from 'react-redux';
import { Layer, Source, Marker } from 'react-map-gl';
import lineSliceAlong from '@turf/line-slice-along';
import length from '@turf/length';
import bezierSpline from '@turf/bezier-spline';
import transformTranslate from '@turf/transform-translate';
import { polygon, lineString } from '@turf/helpers';
import { Feature, LineString } from 'geojson';
import cx from 'classnames';

import { RootState } from 'reducers';
import { datetime2time } from 'utils/timeManipulation';
import { boundedValue } from 'utils/numbers';
import { getCurrentBearing } from 'utils/geometry';
import { Viewport } from 'reducers/map';
import { TrainPosition } from './types';

function getFill(isSelectedTrain: boolean, ecoBlocks) {
  if (isSelectedTrain) {
    return ecoBlocks ? '#82be00' : '#303383';
  }
  return '#333';
}

function getSpeedAndTimeLabel(isSelectedTrain, ecoBlocks, point: TrainPosition) {
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
        {Math.round(point?.speedTime?.speed)}
        km/h
      </span>
    </>
  );
}

// When the train is backward, lineSliceAlong will crash. we need to have head and tail in the right order
export function makeDisplayedHeadAndTail(point: TrainPosition, geojsonPath: Feature<LineString>) {
  const pathLength = length(geojsonPath);
  const trueHead = Math.max(point.tailDistanceAlong, point.headDistanceAlong);
  const trueTail = Math.min(point.tailDistanceAlong, point.headDistanceAlong);
  const boundedHead = boundedValue(trueHead, 0, pathLength);
  const boundedTail = boundedValue(trueTail, 0, pathLength);
  const middle = (boundedHead + boundedTail) / 2;
  return {
    head: boundedHead,
    middle,
    tail: boundedTail,
  };
}

function getzoomPowerOf2LengthFactor(viewport: Viewport, threshold = 12) {
  return 2 ** (threshold - viewport?.zoom);
}

function getFactor(zoomLengthFactor: number, size = 1) {
  return {
    left: 0.05 * zoomLengthFactor * size,
    right: 0.05 * zoomLengthFactor * size,
    up: 0.1 * zoomLengthFactor * size,
    upWidth: 0.019 * zoomLengthFactor * size,
    down: 0.02 * zoomLengthFactor * size,
  };
}

function getHeadTriangle(
  trainGeoJsonPath: Feature<LineString>,
  point: TrainPosition,
  zoomLengthFactor: number
) {
  const factor = getFactor(zoomLengthFactor, 2);
  const bearing = getCurrentBearing(trainGeoJsonPath);
  const left = transformTranslate(point.headPosition, factor.left, bearing - 90);
  const right = transformTranslate(point.headPosition, factor.right, bearing + 90);
  const up = transformTranslate(point.headPosition, factor.up, bearing);
  const down = transformTranslate(point.headPosition, factor.down, bearing + 180);
  const upLeft = transformTranslate(up, factor.upWidth, bearing - 90);
  const upRight = transformTranslate(up, factor.upWidth, bearing + 90);
  const coordinates = [
    down.geometry.coordinates,
    left.geometry.coordinates,
    upLeft.geometry.coordinates,
    upRight.geometry.coordinates,
    right.geometry.coordinates,
    down.geometry.coordinates,
  ];

  const contour = lineString(coordinates);
  const bezier = bezierSpline(contour);
  const triangle = polygon([bezier.geometry.coordinates]);
  return triangle;
}

interface TrainHoverPositionProps {
  point: TrainPosition;
  isSelectedTrain?: boolean;
  geojsonPath: Feature<LineString>;
}

const shiftFactor = {
  long: 1 / 450,
  lat: 1 / 1000,
};

function TrainHoverPosition(props: TrainHoverPositionProps) {
  const { point, isSelectedTrain, geojsonPath } = props;
  const { selectedTrain, allowancesSettings } = useSelector(
    (state: RootState) => state.osrdsimulation
  );
  const { viewport } = useSelector((state: RootState) => state.map);
  const simulation = useSelector((state: RootState) => state.osrdsimulation.simulation.present);
  const trainID = simulation.trains[selectedTrain].id;
  const { ecoBlocks } = allowancesSettings[trainID];
  const fill = getFill(isSelectedTrain as boolean, ecoBlocks);
  const label = getSpeedAndTimeLabel(isSelectedTrain, ecoBlocks, point);

  if (geojsonPath && point.headDistanceAlong && point.tailDistanceAlong) {
    const zoomLengthFactor = getzoomPowerOf2LengthFactor(viewport);
    const { tail, head } = makeDisplayedHeadAndTail(point, geojsonPath);
    const trainGeoJsonPath = lineSliceAlong(geojsonPath, tail, head);
    const triangle = getHeadTriangle(trainGeoJsonPath, point, zoomLengthFactor);
    return (
      <>
        <Marker
          className="map-search-marker"
          longitude={
            point.headPosition.geometry.coordinates[0] + zoomLengthFactor * shiftFactor.long
          }
          latitude={point.headPosition.geometry.coordinates[1] + zoomLengthFactor * shiftFactor.lat}
        >
          {label}
        </Marker>
        <Source type="geojson" data={triangle}>
          <Layer
            id={`${point.id}-head`}
            type="fill"
            paint={{
              'fill-color': fill,
            }}
          />
        </Source>
        <Source type="geojson" data={trainGeoJsonPath}>
          <Layer
            id={`${point.id}-path`}
            type="line"
            paint={{
              'line-width': 8,
              'line-color': fill,
            }}
          />
        </Source>
      </>
    );
  }
  return null;
}

export default TrainHoverPosition;
