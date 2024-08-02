import type { SimulationResponseSuccess } from 'applications/operationalStudies/types';
import type { TrainScheduleResult } from 'common/api/osrdEditoastApi';

import testData from './computeMargins.json';
import computeMargins from '../computeMargins';
import { findNextScheduledOpPoint } from '../utils';

describe('computeMargins', () => {
  it('should compute simple margin', () => {
    const { trainsSimulation, opPoint, nextOpPoint, selectedTrainSchedule, pathStepId } =
      testData[0];

    expect(
      computeMargins(
        trainsSimulation as SimulationResponseSuccess,
        opPoint,
        nextOpPoint,
        selectedTrainSchedule as TrainScheduleResult,
        pathStepId
      )
    ).toEqual({
      theoreticalMargin: '15 %',
      theoreticalMarginSeconds: '77 s',
      calculatedMargin: '77 s',
      diffMargins: '0 s',
    });
  });
  it('should handle index 0 in schedule', () => {
    const { trainsSimulation, opPoint, nextOpPoint, selectedTrainSchedule, pathStepId } =
      testData[1];

    expect(
      computeMargins(
        trainsSimulation as SimulationResponseSuccess,
        opPoint,
        nextOpPoint,
        selectedTrainSchedule as TrainScheduleResult,
        pathStepId
      )
    ).toEqual({
      theoreticalMargin: '50 %',
      theoreticalMarginSeconds: '379 s',
      calculatedMargin: '379 s',
      diffMargins: '0 s',
    });
  });
});

describe('findNextScheduledOpPoint', () => {
  const operationalPoints = [
    {
      id: 'd9c92cb4-tsrn-x',
      name: 'Gondor',
      time: 1715646000,
      speed: 0,
      duration: 0,
      position: 0,
      line_code: 78945612,
      track_number: 9213,
      line_name: 'line α',
      track_name: 'A',
      ch: 'hl',
    },
    {
      id: 'd9b38600-tsrn-x',
      name: 'Gondor',
      time: 1715646048.531712,
      speed: 12.867353322128086,
      duration: 0,
      position: 438,
      line_code: 78945612,
      track_number: 9288,
      line_name: 'line α',
      track_name: 'J1300',
      ch: 't',
    },
    {
      id: 'd94a2af4-tsrn-x',
      name: 'Gondor',
      time: 1715646059.5107863,
      speed: 13.801572793437755,
      duration: 0,
      position: 586,
      line_code: 78945612,
      track_number: 7815,
      line_name: 'line α',
      track_name: 'track_1',
      ch: 'P2',
    },
    {
      id: 'd9cdd03e-tsrn-x',
      name: 'Gondor',
      time: 1715646219.668,
      speed: 18.64034770551918,
      duration: 0,
      position: 2791,
      line_code: 78945612,
      track_number: 940,
      line_name: 'line α',
      track_name: 'a',
      ch: 'PB',
    },
    {
      id: '36239402-c97c-11e7-y',
      name: 'Gondor',
      time: 1715646254.8250234,
      speed: 14.091773148623844,
      duration: 0,
      position: 3308,
      line_code: 78945612,
      track_number: 940,
      line_name: 'line α',
      track_name: 'a',
      ch: '3M',
    },
    {
      id: 'd9c4227a-tsrn-x',
      name: 'Gondor',
      time: 1715646279.9558847,
      speed: 13.990647751771307,
      duration: 0,
      position: 3663,
      line_code: 78945612,
      track_number: 7815,
      line_name: 'line α',
      track_name: 'track_1',
      ch: 'P1',
    },
    {
      id: 'd982df3e-tsrn-x',
      name: 'Mordor',
      time: 1715646528.955,
      speed: 0,
      duration: 0,
      position: 6288,
      line_code: 78945612,
      track_number: 940,
      line_name: 'line α',
      track_name: 'a',
      ch: 'hl',
    },
  ];
  const pathStepsWithOpPointIndex = [
    {
      id: 'id1087',
      deleted: false,
      uic: 78,
      secondary_code: 'hl',
      correspondingOpPointIndex: 0,
    },
    {
      id: 'id461',
      deleted: false,
      uic: 78,
      secondary_code: 'PB',
      correspondingOpPointIndex: 3,
    },
    {
      id: 'id1088',
      deleted: false,
      uic: 456,
      secondary_code: 'hl',
      correspondingOpPointIndex: 6,
    },
  ];
  it('should find the next scheduled pathstep', () => {
    const result = findNextScheduledOpPoint(operationalPoints, pathStepsWithOpPointIndex, 3);
    expect(result).toBe(operationalPoints[6]);
  });
});
