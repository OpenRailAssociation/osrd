import React from 'react';
import { useSelector } from 'react-redux';
import { Layer, Source, Marker } from 'react-map-gl';
import lineSliceAlong from '@turf/line-slice-along';
import length from '@turf/length';
import bezierSpline from '@turf/bezier-spline';
import transformTranslate from '@turf/transform-translate';
import { Point, polygon, lineString } from '@turf/helpers';
import { Feature, LineString } from 'geojson';
import cx from 'classnames';
import { mapValues } from 'lodash';

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

interface TriangleSideDimensions {
  left: number;
  right: number;
  up: number;
  upWidth: number;
  down: number;
}

// When the train is backward, lineSliceAlong will crash. we need to have head and tail in the right order
export function makeDisplayedHeadAndTail(
  point: TrainPosition,
  geojsonPath: Feature<LineString>,
  sideDimensions: {
    head: TriangleSideDimensions;
    tail: TriangleSideDimensions;
  }
): { [key: string]: number } {
  const pathLength = length(geojsonPath);
  const [trueTail, trueHead] = [point.tailDistanceAlong, point.headDistanceAlong].sort(
    (a, b) => a - b
  );
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
  const scaleNumber = (x: number) => x * zoomLengthFactor * size;
  const head = {
    left: 0.05,
    right: 0.05,
    up: 0.1,
    upWidth: 0.019,
    down: 0.02,
  };
  const tail = {
    left: 0.05,
    right: 0.05,
    up: 0.05,
    upWidth: 0.019,
    down: 0.02,
  };
  return {
    head: mapValues(head, scaleNumber),
    tail: mapValues(tail, scaleNumber),
  };
}

function getHeadTriangle(
  trainGeoJsonPath: Feature<LineString>,
  position: Feature<Point>,
  sideDimensions: Record<string, number>
) {
  const bearing = getCurrentBearing(trainGeoJsonPath);
  const left = transformTranslate(position, sideDimensions.left, bearing - 90);
  const right = transformTranslate(position, sideDimensions.right, bearing + 90);
  const up = transformTranslate(position, sideDimensions.up, bearing);
  const down = transformTranslate(position, sideDimensions.down, bearing + 180);
  const upLeft = transformTranslate(up, sideDimensions.upWidth, bearing - 90);
  const upRight = transformTranslate(up, sideDimensions.upWidth, bearing + 90);
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

function getTrainPieces(
  point: TrainPosition,
  geojsonPath: Feature<LineString>,
  zoomLengthFactor: number
) {
  const sideDimensions = getFactor(zoomLengthFactor, 2);
  const { tail, head } = makeDisplayedHeadAndTail(point, geojsonPath, sideDimensions);
  const trainGeoJsonPath = lineSliceAlong(geojsonPath, tail, head);
  const headTriangle = getHeadTriangle(trainGeoJsonPath, point.headPosition, sideDimensions.head);
  const rearTriangle = getHeadTriangle(trainGeoJsonPath, point.tailPosition, sideDimensions.tail);
  return [trainGeoJsonPath, headTriangle, rearTriangle];
}

interface TrainHoverPositionProps {
  point: TrainPosition;
  isSelectedTrain?: boolean;
  geojsonPath: Feature<LineString>;
}

const labelShiftFactor = {
  long: 0.005,
  lat: 0.0011,
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
    const [trainGeoJsonPath, headTriangle, rearTriangle] = getTrainPieces(
      point,
      geojsonPath,
      zoomLengthFactor
    );
    return (
      <>
        <Marker
          className="map-search-marker"
          longitude={
            point.headPosition.geometry.coordinates[0] + zoomLengthFactor * labelShiftFactor.long
          }
          latitude={
            point.headPosition.geometry.coordinates[1] + zoomLengthFactor * labelShiftFactor.lat
          }
        >
          {label}
        </Marker>
        <Source type="geojson" data={headTriangle}>
          <Layer
            id={`${point.id}-head`}
            type="fill"
            paint={{
              'fill-color': fill,
            }}
          />
        </Source>
        <Source type="geojson" data={rearTriangle}>
          <Layer
            id={`${point.id}-rear`}
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
              'line-width': 16,
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
