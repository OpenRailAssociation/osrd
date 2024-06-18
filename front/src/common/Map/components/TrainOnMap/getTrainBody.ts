import along from '@turf/along';
import bezierSpline from '@turf/bezier-spline';
import { type Point, polygon, lineString } from '@turf/helpers';
import length from '@turf/length';
import lineSliceAlong from '@turf/line-slice-along';
import transformTranslate from '@turf/transform-translate';
import type { Feature, LineString } from 'geojson';
import { mapValues } from 'lodash';

import { getCurrentBearing } from 'utils/geometry';
import { clamp } from 'utils/numbers';

import type { TrainCurrentInfo } from './TrainOnMap';

type TriangleSideDimensions = {
  left: number;
  right: number;
  up: number;
  upWidth: number;
  down: number;
};

// When the train is backward, lineSliceAlong will crash. we need to have head and tail in the right order
export const computeExtremityPositionPoints = (
  { headDistanceAlong, tailDistanceAlong }: TrainCurrentInfo,
  geojsonPath: Feature<LineString>,
  sideDimensions: {
    head: TriangleSideDimensions;
    tail: TriangleSideDimensions;
  }
) => {
  const headMinusTriangle = headDistanceAlong - sideDimensions.head.up;
  const tailPlusTriangle = Math.min(
    tailDistanceAlong + sideDimensions.tail.down,
    headMinusTriangle
  );

  const pathLength = length(geojsonPath);
  const headDistance = clamp(headMinusTriangle, [0, pathLength]);
  const tailDistance = clamp(tailPlusTriangle, [0, pathLength]);

  const headPositionPoint = along(geojsonPath, headDistance);
  const tailPositionPoint = along(geojsonPath, tailDistance);

  return {
    headDistance,
    tailDistance,
    headPositionPoint,
    tailPositionPoint,
  };
};

const getTriangleSideDimensions = (zoomLengthFactor: number, size = 2) => {
  const scaleNumber = (x: number) => x * zoomLengthFactor * size;
  const head = {
    left: 0.05,
    right: 0.05,
    up: 0.1,
    upWidth: 0.019,
    down: 0.02,
  };
  const tail = {
    ...head,
    up: 0.05,
  };
  return {
    head: mapValues(head, scaleNumber),
    tail: mapValues(tail, scaleNumber),
  };
};

const getTriangle = (
  trainGeoJsonPath: Feature<LineString>,
  position: Feature<Point>,
  sideDimensions: Record<string, number>
) => {
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
};

const getTrainGeoJsonPath = (
  geojsonPath: Feature<LineString>,
  tailDistance: number,
  headDistance: number
) => {
  const threshold = 0.0005;
  if (headDistance - tailDistance > threshold) {
    return lineSliceAlong(geojsonPath, tailDistance, headDistance);
  }
  if (headDistance > threshold) {
    return lineSliceAlong(geojsonPath, headDistance - threshold, headDistance);
  }
  return lineSliceAlong(geojsonPath, 0, threshold);
};

export const getTrainPieces = (
  trainInfo: TrainCurrentInfo,
  geojsonPath: Feature<LineString>,
  zoomLengthFactor: number
) => {
  const sideDimensions = getTriangleSideDimensions(zoomLengthFactor);

  const { tailDistance, headDistance, headPositionPoint, tailPositionPoint } =
    computeExtremityPositionPoints(trainInfo, geojsonPath, sideDimensions);

  const trainGeoJsonPath = getTrainGeoJsonPath(geojsonPath, tailDistance, headDistance);
  const headTriangle = getTriangle(trainGeoJsonPath, headPositionPoint, sideDimensions.head);
  const rearTriangle = getTriangle(trainGeoJsonPath, tailPositionPoint, sideDimensions.tail);

  return {
    trainBody: { name: 'path', data: trainGeoJsonPath },
    trainExtremities: [
      { name: 'head', data: headTriangle },
      { name: 'tail', data: rearTriangle },
    ],
  };
};
