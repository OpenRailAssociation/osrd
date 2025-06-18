import { describe, it, expect } from 'vitest';

import { Duration } from 'utils/duration';

import {
  generateCodeNumber,
  getStopDurationTime,
  getStopDurationAtPosition,
  findAllStops,
  insertMissingStopsInOperationalPointsWithTimes,
} from '../formatSimulationReportSheet';

describe('generateCodeNumber', () => {
  it('should return a formatted string', () => {
    const codeNumber = generateCodeNumber();
    expect(codeNumber).toMatch(/^\d{2}\d{2}-\d{3}-\d{3}$/);
  });
});

describe('getStopDurationTime', () => {
  it('should return correct time format', () => {
    expect(getStopDurationTime(new Duration({ seconds: 120 }))).toBe('2 min');
  });
});

describe('getStopDurationBetweenTwoPositions', () => {
  it('should return stop duration correctly', () => {
    const train = {
      positions: [1, 2, 2, 3, 4, 5],
      times: [0, 120000, 180000, 200000, 220000, 230000],
      speeds: [0, 0, 2, 0, 2, 0],
      departureHour: 1,
      departureMinute: 2,
    };
    expect(getStopDurationAtPosition(1, train)).toBeNull(); // departure
    expect(getStopDurationAtPosition(2, train)).toEqual(new Duration({ milliseconds: 60000 })); // standard stop
    expect(getStopDurationAtPosition(3, train)).toEqual(new Duration({ milliseconds: 0 })); // zero duration stop
    expect(getStopDurationAtPosition(4, train)).toBeNull(); // non stop
    expect(getStopDurationAtPosition(5, train)).toBeNull(); // arrival
  });
});

describe('findAllStops', () => {
  it('should return all stop positions', () => {
    const positions = [0, 1, 2, 2, 3, 4, 4, 4, 5, 6, 7, 7, 8];
    const speeds = [5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5, 5];
    expect(findAllStops(positions, speeds)).toStrictEqual([2, 4, 7, 8]);
    const positions2 = [0, 0, 1, 2, 3, 4, 5, 5, 5, 6, 7, 8, 9, 10];
    const speeds2 = [5, 5, 5, 0, 5, 5, 0, 0, 0, 5, 5, 0, 5, 0];
    expect(findAllStops(positions2, speeds2)).toStrictEqual([0, 2, 5, 8, 10]);
  });
});

describe('insertsMissingStopsInOperationalPointsWithTimes', () => {
  const opA = {
    opId: 'A',
    positionOnPath: 0,
    time: '10:00',
    duration: null,
    stopEndTime: '10:00',
    stopRequested: false,
  };
  const opB = {
    opId: 'B',
    positionOnPath: 50,
    time: '10:10',
    duration: null,
    stopEndTime: '10:10',
    stopRequested: false,
  };
  const opC = {
    opId: 'C',
    positionOnPath: 100,
    time: '10:20',
    duration: null,
    stopEndTime: '10:20',
    stopRequested: false,
  };
  const opD = {
    opId: 'D',
    positionOnPath: 150,
    time: '10:30',
    duration: null,
    stopEndTime: '10:30',
    stopRequested: false,
  };
  const opAwStop = {
    ...opA,
    stopRequested: true,
    duration: new Duration({ seconds: 60 }),
    stopEndTime: '10:01',
  };
  const opCwStop = {
    ...opC,
    stopRequested: true,
    duration: new Duration({ seconds: 180 }),
    stopEndTime: '10:23',
  };
  const opDwStop = {
    ...opD,
    stopRequested: true,
    duration: new Duration({ seconds: 120 }),
    stopEndTime: '10:32',
  };
  const opAwStopNotDone = { ...opA, stopRequested: true };
  const opCwStopNotDone = { ...opC, stopRequested: true };
  const opDwStopNotDone = { ...opD, stopRequested: true };

  it('should ignore stops already present in ops', () => {
    const stopPositions = [0, 100, 150];
    const train = {
      positions: [0, 0, 50, 100, 100, 150, 150],
      times: [0, 60000, 600000, 1200000, 1380000, 1800000, 1920000],
      speeds: [0, 2, 2, 0, 2, 2, 0],
      departureHour: 10,
      departureMinute: 0,
    };
    const result = insertMissingStopsInOperationalPointsWithTimes(
      [opAwStop, opB, opCwStop, opDwStop],
      stopPositions,
      train
    );
    expect(result).toEqual([opAwStop, opB, opCwStop, opDwStop]);
  });

  it('should edit stop duration of ops when their planned stop actually occurs between it and the next op', () => {
    const stopPositions = [2, 101, 154];
    const train = {
      positions: [0, 2, 2, 50, 100, 101, 101, 150, 154, 154],
      times: [0, 2000, 62000, 600000, 1200000, 1202000, 1382000, 1800000, 1840000, 2140000],
      speeds: [0, 0, 2, 2, 2, 0, 2, 2, 2, 0],
      departureHour: 10,
      departureMinute: 0,
    };
    const result = insertMissingStopsInOperationalPointsWithTimes(
      [opAwStopNotDone, opB, opCwStopNotDone, opDwStopNotDone],
      stopPositions,
      train
    );
    expect(result).toEqual([
      opAwStop,
      opB,
      opCwStop,
      { ...opDwStop, duration: new Duration({ seconds: 300 }), stopEndTime: '10:36' },
    ]);
  });

  it('should create and insert unplanned stops as new ops', () => {
    const stopPositions = [75, 100, 125];
    const train = {
      positions: [0, 50, 75, 75, 100, 125, 125, 150],
      times: [0, 600000, 900000, 960000, 1200000, 1500000, 1560000, 1800000],
      speeds: [0, 2, 0, 2, 0, 0, 2, 0],
      departureHour: 10,
      departureMinute: 0,
    };
    const result = insertMissingStopsInOperationalPointsWithTimes(
      [opA, opB, opCwStop, opD],
      stopPositions,
      train
    );
    expect(result).toEqual([
      opA,
      opB,
      {
        opId: 'unplanned_stop_at_75',
        positionOnPath: 75,
        duration: new Duration({ seconds: 60 }),
        time: '10:15',
        stopEndTime: '10:16',
        stopRequested: false,
      },
      opCwStop,
      {
        opId: 'unplanned_stop_at_125',
        positionOnPath: 125,
        duration: new Duration({ seconds: 60 }),
        time: '10:25',
        stopEndTime: '10:26',
        stopRequested: false,
      },
      opD,
    ]);
  });
});
