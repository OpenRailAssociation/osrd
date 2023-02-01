import React from 'react';
import { useSelector } from 'react-redux';
import { Source, Marker } from 'react-map-gl';
import along from '@turf/along';
import lineSliceAlong from '@turf/line-slice-along';
import length from '@turf/length';
import bezierSpline from '@turf/bezier-spline';
import transformTranslate from '@turf/transform-translate';
import { Point, polygon, lineString } from '@turf/helpers';
import { Feature, LineString } from 'geojson';
import cx from 'classnames';
import { mapValues, get } from 'lodash';

import { RootState } from 'reducers';
import { Viewport } from 'reducers/map';
import { AllowancesSetting } from 'reducers/osrdsimulation/types';
import { datetime2time } from 'utils/timeManipulation';
import { boundedValue } from 'utils/numbers';
import { getCurrentBearing } from 'utils/geometry';
import OrderedLayer from 'common/Map/Layers/OrderedLayer';
import { TrainPosition } from './types';

function getFill(isSelectedTrain: boolean, ecoBlocks: boolean) {
  if (isSelectedTrain) {
    return ecoBlocks ? '#82be00' : '#303383';
  }
  return '#333';
}

function getSpeedAndTimeLabel(isSelectedTrain: boolean, ecoBlocks: boolean, point: TrainPosition) {
  if (isSelectedTrain) {
    return (
      <>
        <span
          className={cx('small', 'font-weight-bold', ecoBlocks ? 'text-secondary' : 'text-primary')}
        >
          {Math.round(point?.speedTime?.speed ?? 0)}
          km/h
        </span>
        <span className="ml-2 small">
          {point.speedTime && datetime2time(point.speedTime.time as any)}
        </span>
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
) {
  const pathLength = length(geojsonPath);
  const [trueTail, trueHead] = [point.tailDistanceAlong, point.headDistanceAlong].sort(
    (a, b) => a - b
  );

  const headMinusTriangle = trueHead - sideDimensions.head.up;
  const tailPlusTriangle = Math.min(trueTail + sideDimensions.tail.down, headMinusTriangle);
  const boundedHead = boundedValue(headMinusTriangle, [0, pathLength]);
  const boundedTail = boundedValue(tailPlusTriangle, [0, pathLength]);

  const headPosition = along(geojsonPath, boundedHead);
  const tailPosition = along(geojsonPath, boundedTail);
  return {
    headDistance: boundedHead,
    tailDistance: boundedTail,
    headPosition,
    tailPosition,
  };
}

function getzoomPowerOf2LengthFactor(viewport: Viewport, threshold = 12) {
  return 2 ** (threshold - viewport?.zoom);
}

function getTriangleSideDimensions(zoomLengthFactor: number, size = 1) {
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

function getTrainGeoJsonPath(
  geojsonPath: Feature<LineString>,
  tailDistance: number,
  headDistance: number
) {
  const threshold = 0.0005;
  if (headDistance - tailDistance > threshold) {
    return lineSliceAlong(geojsonPath, tailDistance, headDistance);
  }
  if (headDistance > threshold) {
    return lineSliceAlong(geojsonPath, headDistance - threshold, headDistance);
  }
  return lineSliceAlong(geojsonPath, 0, threshold);
}

function getTrainPieces(
  point: TrainPosition,
  geojsonPath: Feature<LineString>,
  zoomLengthFactor: number
) {
  const sideDimensions = getTriangleSideDimensions(zoomLengthFactor, 2);
  const { tailDistance, headDistance, headPosition, tailPosition } = makeDisplayedHeadAndTail(
    point,
    geojsonPath,
    sideDimensions
  );
  const trainGeoJsonPath = getTrainGeoJsonPath(geojsonPath, tailDistance, headDistance);
  const headTriangle = getHeadTriangle(trainGeoJsonPath, headPosition, sideDimensions.head);
  const rearTriangle = getHeadTriangle(trainGeoJsonPath, tailPosition, sideDimensions.tail);
  return [trainGeoJsonPath, headTriangle, rearTriangle];
}

interface TrainHoverPositionProps {
  point: TrainPosition;
  isSelectedTrain?: boolean;
  geojsonPath: Feature<LineString>;
  layerOrder: number;
}

const labelShiftFactor = {
  long: 0.005,
  lat: 0.0011,
};

function TrainHoverPosition(props: TrainHoverPositionProps) {
  const { point, isSelectedTrain = false, geojsonPath, layerOrder } = props;
  const { selectedTrain, allowancesSettings } = useSelector(
    (state: RootState) => state.osrdsimulation
  );
  const { viewport } = useSelector((state: RootState) => state.map);
  const simulation = useSelector((state: RootState) => state.osrdsimulation.simulation.present);
  const trainID = simulation.trains[selectedTrain].id;
  const { ecoBlocks } = get(allowancesSettings, trainID, {} as AllowancesSetting);
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
          <OrderedLayer
            id={`${point.id}-head`}
            type="fill"
            paint={{
              'fill-color': fill,
            }}
            layerOrder={layerOrder}
          />
        </Source>
        <Source type="geojson" data={rearTriangle}>
          <OrderedLayer
            id={`${point.id}-rear`}
            type="fill"
            paint={{
              'fill-color': fill,
            }}
            layerOrder={layerOrder}
          />
        </Source>
        <Source type="geojson" data={trainGeoJsonPath}>
          <OrderedLayer
            id={`${point.id}-path`}
            type="line"
            paint={{
              'line-width': 16,
              'line-color': fill,
            }}
            layerOrder={layerOrder}
          />
        </Source>
      </>
    );
  }
  return null;
}

export default TrainHoverPosition;
