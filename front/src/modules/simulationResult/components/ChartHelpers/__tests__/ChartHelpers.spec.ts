import { LIST_VALUES, CHART_AXES } from 'modules/simulationResult/consts';
import type { SimulationTrain } from 'reducers/osrdsimulation/types';

import simulationTrain from '../../../../../../tests/assets/operationStudies/simulationTrain';
import train from '../../../../../../tests/assets/operationStudies/trainExample';
import {
  mergeDatasArea,
  interpolateOnTime,
  trainWithDepartureAndArrivalTimes,
  getAxis,
} from '../ChartHelpers';

describe('mergeDatasArea', () => {
  test('avoid crash', () => {
    expect(mergeDatasArea()).toEqual([]);
  });
});

describe('interpolateOnTime', () => {
  describe('Regime', () => {
    it('should interpolate t=43294 using values t=43290 t=43298', () => {
      const dataSimulation = train.base;
      const time = 43294;
      const result = interpolateOnTime(
        dataSimulation,
        CHART_AXES.SPACE_TIME,
        LIST_VALUES.REGIME
      )(time);
      expect(result).toStrictEqual({
        head_positions: { position: 1870.9890488984856, speed: 0, time },
        tail_positions: { position: 1471.3290488984856, speed: 0, time },
        speeds: {
          position: 1867.5542127909848,
          speed: 144.27589007183147,
          time,
        },
      });
    });
  });
  describe('SimulationTrain', () => {
    it('should interpolate t=11:57:37 using values t=11:57:31 t=11:57:52', () => {
      const dataSimulation: SimulationTrain = simulationTrain[0];
      const time = new Date('1900-01-01T11:57:37.000Z');
      const result = interpolateOnTime(
        dataSimulation,
        CHART_AXES.SPACE_TIME,
        LIST_VALUES.SPACE_TIME
      )(time);
      expect(result).toStrictEqual({
        headPosition: {
          position: 16662.376939865702,
          speed: 0,
          time: new Date('1900-01-01T11:57:37.000Z'),
        },
        tailPosition: {
          position: 16262.716939865702,
          speed: 0,
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
      const result = trainWithDepartureAndArrivalTimes(train);
      expect(result).toEqual({
        id: 395,
        labels: [],
        train_name: 'Fonction ζ',
        path_id: 596,
        departure_time: 43200,
        arrival_time: 44417.01477978789,
        speed_limit_tags: undefined,
        duration: 1217.014779787889,
        mechanical_energy_consumed: {
          base: 4341138851.046319,
          eco: 4341138851.046319,
        },
        path_length: 54483.80299490723,
        stops_count: 0,
      });
    });
  });

  describe('with offset', () => {
    it('should add the given offset to arrival and departure', () => {
      const result = trainWithDepartureAndArrivalTimes(train, 1000);
      expect(result).toEqual({
        id: 395,
        labels: [],
        train_name: 'Fonction ζ',
        path_id: 596,
        departure_time: 44200,
        arrival_time: 45417.01477978789,
        speed_limit_tags: undefined,
        duration: 1217.014779787889,
        mechanical_energy_consumed: {
          base: 4341138851.046319,
          eco: 4341138851.046319,
        },
        path_length: 54483.80299490723,
        stops_count: 0,
      });
    });
    it('should handle time exceeding midnight', () => {
      const result = trainWithDepartureAndArrivalTimes(train, 86400);
      expect(result).toEqual({
        id: 395,
        labels: [],
        train_name: 'Fonction ζ',
        path_id: 596,
        departure_time: 43200,
        arrival_time: 44417.01477978789,
        speed_limit_tags: undefined,
        duration: 1217.014779787889,
        mechanical_energy_consumed: {
          base: 4341138851.046319,
          eco: 4341138851.046319,
        },
        path_length: 54483.80299490723,
        stops_count: 0,
      });
    });
    it('should handle time before midnight', () => {
      const result = trainWithDepartureAndArrivalTimes(train, -86400);
      expect(result).toEqual({
        id: 395,
        labels: [],
        train_name: 'Fonction ζ',
        path_id: 596,
        departure_time: 43200,
        arrival_time: 44417.01477978789,
        speed_limit_tags: undefined,
        duration: 1217.014779787889,
        mechanical_energy_consumed: {
          base: 4341138851.046319,
          eco: 4341138851.046319,
        },
        path_length: 54483.80299490723,
        stops_count: 0,
      });
    });
  });
});

describe('getAxis', () => {
  it.each`
    axis   | rotate   | expected
    ${'x'} | ${false} | ${'time'}
    ${'y'} | ${false} | ${'position'}
    ${'x'} | ${true}  | ${'position'}
    ${'y'} | ${true}  | ${'time'}
  `(
    'should return the correct axis name (axis=$axis, rotate=$rotate, expected=$expected',
    ({ axis, rotate, expected }) => {
      expect(getAxis(CHART_AXES.SPACE_TIME, axis, rotate)).toBe(expected);
    }
  );
});
