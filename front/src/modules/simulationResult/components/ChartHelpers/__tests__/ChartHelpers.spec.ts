import { describe, it, expect } from 'vitest';

import { LIST_VALUES, CHART_AXES } from 'modules/simulationResult/consts';

import simulationTrain from '../../../../../assets/operationStudies/simulationTrain';
import train from '../../../../../assets/operationStudies/trainExample';
import { interpolateOnTime, getAxis } from '../ChartHelpers';

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
      const dataSimulation = simulationTrain[0];
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
