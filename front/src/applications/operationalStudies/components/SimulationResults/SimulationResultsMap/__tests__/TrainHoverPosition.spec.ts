import { lineString, point, lengthToDegrees } from '@turf/helpers';

import { makeDisplayedHeadAndTail } from '../TrainHoverPosition';
import { TrainPosition } from '../types';

// test examples are given on a grid with kilometer unit
function convertKmCoordsToDegree(coords: Array<number>) {
  return coords.map((v) => lengthToDegrees(v));
}

// test examples are given on a grid with kilometer unit
function pointFromKmCoords(coords: Array<number>) {
  return point(convertKmCoordsToDegree(coords));
}

const unitKmSquare = [
  convertKmCoordsToDegree([0, 0]),
  convertKmCoordsToDegree([1, 0]),
  convertKmCoordsToDegree([1, 1]),
  convertKmCoordsToDegree([0, 1]),
];

const unitKmLine = [convertKmCoordsToDegree([0, 0]), convertKmCoordsToDegree([1, 0])];

const makeSideDimensions = (headUp = 0, tailDown = 0) => ({
  head: {
    left: 0,
    right: 0,
    up: headUp,
    upWidth: 0,
    down: 0,
  },
  tail: {
    left: 0,
    right: 0,
    up: 0,
    upWidth: 0,
    down: tailDown,
  },
});
describe('makeDisplayedHeadAndTail', () => {
  describe('normal train', () => {
    it('should return train head and tail distance along the path', () => {
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
      const sideDimensions = makeSideDimensions();
      const { headDistance: head, tailDistance: tail } = makeDisplayedHeadAndTail(
        trainPosition,
        pathLineString,
        sideDimensions
      );
      expect(head).toEqual(1);
      expect(tail).toEqual(0);
    });
    it('should take the size of the tail and head triangle into account', () => {
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
      const sideDimensions = makeSideDimensions(0.1, 0.1);
      const { headDistance: head, tailDistance: tail } = makeDisplayedHeadAndTail(
        trainPosition,
        pathLineString,
        sideDimensions
      );
      expect(head).toEqual(0.9);
      expect(tail).toEqual(0.1);
    });
    it('should avoid overlapping head and tail. Head should be exact/tail should not exceed over the head', () => {
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
      const sideDimensions = makeSideDimensions(0.6, 0.7);
      const { headDistance: head, tailDistance: tail } = makeDisplayedHeadAndTail(
        trainPosition,
        pathLineString,
        sideDimensions
      );
      expect(head).toEqual(0.4);
      expect(tail).toEqual(0.4);
    });
    test('triangle correction should not make head/tail go beyound track limits', () => {
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
      const sideDimensions = makeSideDimensions(10, 10);
      const { headDistance: head, tailDistance: tail } = makeDisplayedHeadAndTail(
        trainPosition,
        pathLineString,
        sideDimensions
      );
      expect(head).toEqual(0);
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
      const sideDimensions = makeSideDimensions();
      const { headDistance: head, tailDistance: tail } = makeDisplayedHeadAndTail(
        trainPosition,
        pathLineString,
        sideDimensions
      );
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
      const sideDimensions = makeSideDimensions();
      const { headDistance: head, tailDistance: tail } = makeDisplayedHeadAndTail(
        trainPosition,
        pathLineString,
        sideDimensions
      );
      expect(head).toBeCloseTo(1, 6);
      expect(tail).toBeCloseTo(1, 6);
    });
  });
});
