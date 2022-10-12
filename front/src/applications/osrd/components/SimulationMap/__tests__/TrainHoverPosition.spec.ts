import { lineString, point, lengthToDegrees } from '@turf/helpers';

import { makeDisplayedHeadAndTail, TrainPosition } from '../TrainHoverPosition';

// test examples are given on a grid with kilometer unit
function convertKmCoordsToDegree(coords) {
  return coords.map((v) => lengthToDegrees(v));
}

// test examples are given on a grid with kilometer unit
function pointFromKmCoords(coords) {
  return point(convertKmCoordsToDegree(coords));
}

const unitKmSquare = [
  convertKmCoordsToDegree([0, 0]),
  convertKmCoordsToDegree([1, 0]),
  convertKmCoordsToDegree([1, 1]),
  convertKmCoordsToDegree([0, 1]),
];

const unitKmLine = [convertKmCoordsToDegree([0, 0]), convertKmCoordsToDegree([1, 0])];

describe('makeDisplayedHeadAndTail', () => {
  describe('normal train', () => {
    it('should return train head and tail to display', () => {
      const trainPosition: TrainPosition = {
        id: 'train',
        headPosition: pointFromKmCoords([1, 0]),
        tailPosition: pointFromKmCoords([0, 0]),
        headDistanceAlong: 1,
        tailDistanceAlong: 0,
        speedTime: { speed: 0, time: 0 },
        trainLength: 1,
      };
      const pathPoints = unitKmSquare;
      const pathLineString = lineString(pathPoints);
      const { head, tail } = makeDisplayedHeadAndTail(trainPosition, pathLineString);
      expect(head).toEqual(1);
      expect(tail).toEqual(0);
    });
  });
  describe('backward train', () => {
    it('should return train head and tail', () => {
      const trainPosition: TrainPosition = {
        id: 'train',
        headPosition: pointFromKmCoords([0, 0]),
        tailPosition: pointFromKmCoords([1, 0]),
        headDistanceAlong: 1,
        tailDistanceAlong: 0,
        speedTime: { speed: 0, time: 0 },
        trainLength: 1,
      };
      const pathPoints = unitKmSquare;
      const pathLineString = lineString(pathPoints);
      const { head, tail } = makeDisplayedHeadAndTail(trainPosition, pathLineString);
      expect(head).toEqual(1);
      expect(tail).toEqual(0);
    });
  });
  describe('train outside of the path', () => {
    it('should return train head and tail bounded in path', () => {
      const trainPosition: TrainPosition = {
        id: 'train',
        headPosition: pointFromKmCoords([1, 0]),
        tailPosition: pointFromKmCoords([2, 0]),
        headDistanceAlong: 2,
        tailDistanceAlong: 1,
        speedTime: { speed: 0, time: 0 },
        trainLength: 1,
      };
      const pathPoints = unitKmLine;
      const pathLineString = lineString(pathPoints);
      const { head, tail } = makeDisplayedHeadAndTail(trainPosition, pathLineString);
      expect(head).toBeCloseTo(1, 6);
      expect(tail).toBeCloseTo(1, 6);
    });
  });
});
