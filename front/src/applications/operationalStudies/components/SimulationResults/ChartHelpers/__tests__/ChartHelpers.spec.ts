import { Regime, SimulationTrain } from 'reducers/osrdsimulation/types';
import {
  mergeDatasArea,
  interpolateOnTime,
  trainWithDepartureAndArrivalTimes,
} from '../ChartHelpers';
import { LIST_VALUES_NAME_SPACE_TIME } from '../../simulationResultsConsts';

import train from '../../../../../../../tests/assets/operationStudies/train.json';
import simulationTrain from '../../../../../../../tests/assets/operationStudies/simulationTrain';

describe('mergeDatasArea', () => {
  test('avoid crash', () => {
    expect(mergeDatasArea()).toEqual([]);
  });
});

describe('interpolateOnTime', () => {
  describe('Regime', () => {
    it('should interpolate t=43294 using values t=43290 t=43298', () => {
      const dataSimulation: Regime = train[0].base;
      const keyValues = ['time', 'position'];
      const listValues = ['head_positions', 'tail_positions', 'speeds'];
      const time = 43294;
      const result = interpolateOnTime(dataSimulation, keyValues, listValues, time);
      expect(result).toStrictEqual({
        head_positions: { position: 1870.9890488984856, speed: NaN, time: 43294 },
        tail_positions: { position: 1471.3290488984856, speed: NaN, time: 43294 },
        speeds: {
          position: 1867.5542127909848,
          speed: 144.27589007183147,
          time: 43294,
        },
      });
    });
  });
  describe('SimulationTrain', () => {
    it('should interpolate t=11:57:37 using values t=11:57:31 t=11:57:52', () => {
      const dataSimulation: SimulationTrain = simulationTrain[0];
      const keyValues = ['time'] as const;
      const listValues = LIST_VALUES_NAME_SPACE_TIME;
      const time = new Date('1900-01-01T11:57:37.000Z');
      const result = interpolateOnTime<(typeof listValues)[number], Date>(
        dataSimulation,
        keyValues,
        listValues,
        time
      );
      expect(result).toStrictEqual({
        headPosition: {
          position: 16662.376939865702,
          speed: NaN,
          time: new Date('1900-01-01T11:57:37.000Z'),
        },
        tailPosition: {
          position: 16262.716939865702,
          speed: NaN,
          time: new Date('1900-01-01T11:57:37.000Z'),
        },
        speed: {
          position: 16677.064821824115,
          speed: 209.04144260747736,
          time: new Date('1900-01-01T11:57:37.000Z'),
        },
      });
    });
  });
});

describe('offsetTrainDepartureAndArrivalTimes', () => {
  describe('no offset', () => {
    test('add departure & arrival time', () => {
      const result = trainWithDepartureAndArrivalTimes(train[0]);
      expect(result).toEqual({
        id: 395,
        labels: [],
        name: 'Fonction ζ',
        path: 596,
        departure: 43200,
        arrival: 44417.01477978789,
        speed_limit_tags: undefined,
      });
    });
  });

  describe('with offset', () => {
    it('should add the given offset to arrival and departure', () => {
      const result = trainWithDepartureAndArrivalTimes(train[0], 1000);
      expect(result).toEqual({
        id: 395,
        labels: [],
        name: 'Fonction ζ',
        path: 596,
        departure: 44200,
        arrival: 45417.01477978789,
        speed_limit_tags: undefined,
      });
    });
    it('should handle time exceeding midnight', () => {
      const result = trainWithDepartureAndArrivalTimes(train[0], 86400);
      expect(result).toEqual({
        id: 395,
        labels: [],
        name: 'Fonction ζ',
        path: 596,
        departure: 43200,
        arrival: 44417.01477978789,
        speed_limit_tags: undefined,
      });
    });
    it('should handle time before midnight', () => {
      const result = trainWithDepartureAndArrivalTimes(train[0], -86400);
      expect(result).toEqual({
        id: 395,
        labels: [],
        name: 'Fonction ζ',
        path: 596,
        departure: 43200,
        arrival: 44417.01477978789,
        speed_limit_tags: undefined,
      });
    });
  });
});
