import { describe, it, expect } from 'vitest';

import { type TimesStopsInputRow } from 'modules/timesStops/types';

import {
  updateRowTimesAndMargin,
  updateDaySinceDeparture,
  durationSinceStartTime,
  calculateStepTimeAndDays,
} from '../utils';

describe('updateRowTimesAndMargin', () => {
  const whateverOperation = { fromRowIndex: 2 };

  describe('arrival is set, departure just changed', () => {
    it('should update stop duration from the arrival and departure', () => {
      const rowData = {
        opId: 'd94a2af4',
        name: 'Gr',
        arrival: { time: '23:40:00' },
        departure: { time: '23:50:00' },
        stopFor: '300', // no longer correct, not yet updated by the function
      } as TimesStopsInputRow;
      const previousRowData = {
        opId: 'd94a2af4',
        name: 'Gr',
        arrival: { time: '23:40:00' },
        departure: { time: '23:45:00' },
        stopFor: '300',
      } as TimesStopsInputRow;
      const result = updateRowTimesAndMargin(rowData, previousRowData, whateverOperation, 4);
      expect(result).toEqual({
        opId: 'd94a2af4',
        name: 'Gr',
        arrival: { time: '23:40:00' },
        departure: { time: '23:50:00' },
        stopFor: '600', // now correct with the new arrival and departure
        isMarginValid: true,
      });
    });
  });
  describe('theoretical margin is incorrect', () => {
    it('should set isMarginValid flag to false', () => {
      const rowData = {
        opId: 'd94a2af4',
        name: 'Gr',
        theoreticalMargin: '10',
      } as TimesStopsInputRow;
      const previousRowData = {
        opId: 'd94a2af4',
        name: 'Gr',
      } as TimesStopsInputRow;
      const result = updateRowTimesAndMargin(rowData, previousRowData, whateverOperation, 4);
      expect(result.isMarginValid).toBe(false);
    });
  });
  describe('user removed first row theoretical margin', () => {
    it('should set the theoretical margin back to 0%', () => {
      const rowData = {
        opId: 'd94a2af4',
        name: 'Gr',
      } as TimesStopsInputRow;
      const previousRowData = {
        opId: 'd94a2af4',
        name: 'Gr',
        theoreticalMargin: '10%',
      } as TimesStopsInputRow;
      const operation = {
        fromRowIndex: 0,
      };
      const result = updateRowTimesAndMargin(rowData, previousRowData, operation, 4);
      expect(result).toEqual({
        opId: 'd94a2af4',
        name: 'Gr',
        arrival: undefined,
        isMarginValid: true,
        onStopSignal: false,
        theoreticalMargin: '0%',
      });
    });
  });
  describe('arrival is before midnight, departure after midnight', () => {
    it('should compute the stopFor correctly', () => {
      const rowData = {
        opId: 'd94a2af4',
        name: 'Gr',
        arrival: { time: '23:40:00' },
        departure: { time: '00:20:00' },
        stopFor: '300',
      } as TimesStopsInputRow;
      const previousRowData = {
        opId: 'd94a2af4',
        name: 'Gr',
        arrival: { time: '23:40:00' },
        departure: { time: '23:45:00' },
        stopFor: '300',
      } as TimesStopsInputRow;
      const result = updateRowTimesAndMargin(rowData, previousRowData, whateverOperation, 4);
      expect(result).toEqual({
        opId: 'd94a2af4',
        name: 'Gr',
        arrival: { time: '23:40:00' },
        departure: { time: '00:20:00' },
        stopFor: '2400',
        isMarginValid: true,
      });
    });
  });
  describe('arrival, departure & stopFor are set, arrival gets erased', () => {
    it('should keep stopFor and remove departure', () => {
      const rowData = {
        opId: 'd94a2af4',
        name: 'Gr',
        arrival: undefined,
        departure: { time: '00:20:00' },
        stopFor: '600',
      } as TimesStopsInputRow;
      const previousRowData = {
        opId: 'd94a2af4',
        name: 'Gr',
        arrival: { time: '00:10:00' },
        departure: { time: '00:20:00' },
        stopFor: '600',
      } as TimesStopsInputRow;
      const result = updateRowTimesAndMargin(rowData, previousRowData, whateverOperation, 4);
      expect(result).toEqual({
        opId: 'd94a2af4',
        name: 'Gr',
        arrival: undefined,
        departure: undefined,
        stopFor: '600',
        isMarginValid: true,
      });
    });
    it('should keep stopFor and remove departure (double click + delete button version', () => {
      const rowData = {
        opId: 'd94a2af4',
        name: 'Gr',
        arrival: { time: '' },
        departure: { time: '00:20:00' },
        stopFor: '600',
      } as TimesStopsInputRow;
      const previousRowData = {
        opId: 'd94a2af4',
        name: 'Gr',
        arrival: { time: '00:10:00' },
        departure: { time: '00:20:00' },
        stopFor: '600',
      } as TimesStopsInputRow;
      const result = updateRowTimesAndMargin(rowData, previousRowData, whateverOperation, 4);
      expect(result).toEqual({
        opId: 'd94a2af4',
        name: 'Gr',
        arrival: { time: '' },
        departure: undefined,
        stopFor: '600',
        isMarginValid: true,
      });
    });
  });
  describe('arrival, departure & stopFor are set, departure gets erased', () => {
    it('should keep arrival and remove stopFor', () => {
      const rowData = {
        opId: 'd94a2af4',
        name: 'Gr',
        arrival: { time: '00:10:00' },
        departure: undefined,
        stopFor: '600',
      } as TimesStopsInputRow;
      const previousRowData = {
        opId: 'd94a2af4',
        name: 'Gr',
        arrival: { time: '00:10:00' },
        departure: { time: '00:20:00' },
        stopFor: '600',
      } as TimesStopsInputRow;
      const result = updateRowTimesAndMargin(rowData, previousRowData, whateverOperation, 4);
      expect(result).toEqual({
        opId: 'd94a2af4',
        name: 'Gr',
        arrival: { time: '00:10:00' },
        departure: undefined,
        stopFor: undefined,
        isMarginValid: true,
        onStopSignal: false,
      });
    });
  });
  describe('stopFor only is set, departure gets added', () => {
    it('should set arrival too', () => {
      const rowData = {
        opId: 'd94a2af4',
        name: 'Gr',
        arrival: undefined,
        departure: { time: '00:20:00' },
        stopFor: '600',
      } as TimesStopsInputRow;
      const previousRowData = {
        opId: 'd94a2af4',
        name: 'Gr',
        arrival: undefined,
        departure: undefined,
        stopFor: '600',
      } as TimesStopsInputRow;
      const result = updateRowTimesAndMargin(rowData, previousRowData, whateverOperation, 4);
      expect(result).toEqual({
        opId: 'd94a2af4',
        name: 'Gr',
        arrival: { time: '00:10:00' },
        departure: { time: '00:20:00' },
        stopFor: '600',
        isMarginValid: true,
      });
    });
  });
});

describe('updateDaySinceDeparture', () => {
  describe('1 day span', () => {
    it('should add the day since departure', () => {
      const TimesStopsInputRows = [
        {
          opId: 'd9c92cb4',
          name: 'Ge',
          uic: 86,
          ch: 'BV',
          arrival: { time: '10:00:00' },
        },
      ] as TimesStopsInputRow[];
      const startTime = '2024-08-13T10:00:00';
      const result = updateDaySinceDeparture(TimesStopsInputRows, startTime, true);
      const expected = [
        {
          opId: 'd9c92cb4',
          name: 'Ge',
          uic: 86,
          ch: 'BV',
          arrival: { time: '10:00:00', daySinceDeparture: 0 },
          departure: undefined,
        },
      ];
      expect(result).toEqual(expected);
    });
    it('should format departure', () => {
      const TimesStopsInputRows = [
        {
          opId: 'd9c92cb4',
          name: 'Ge',
          uic: 86,
          ch: 'BV',
          arrival: { time: '10:00:00' },
        },
        {
          opId: 'd9c92cb4',
          name: 'Ge',
          uic: 86,
          ch: 'BX',
          arrival: { time: '11:00:00' },
          stopFor: '1800',
        },
      ] as TimesStopsInputRow[];
      const startTime = '2024-08-13T10:00:00';
      const result = updateDaySinceDeparture(TimesStopsInputRows, startTime, true);
      const expected = [
        {
          opId: 'd9c92cb4',
          name: 'Ge',
          uic: 86,
          ch: 'BV',
          arrival: { time: '10:00:00', daySinceDeparture: 0 },
          departure: undefined,
        },
        {
          opId: 'd9c92cb4',
          name: 'Ge',
          uic: 86,
          ch: 'BX',
          arrival: { time: '11:00:00', daySinceDeparture: 0 },
          departure: { time: '11:30:00', daySinceDeparture: 0 },
          stopFor: '1800',
        },
      ];
      expect(result).toEqual(expected);
    });
  });
  describe('2 day span', () => {
    it('should add day 1 field', () => {
      const TimesStopsInputRows = [
        {
          opId: 'd9c92cb4',
          name: 'Ge',
          uic: 86,
          ch: 'BV',
          arrival: { time: '23:50:00' },
        },
        {
          opId: 'd9b38600',
          name: 'Ge',
          uic: 86,
          ch: 'BX',
          arrival: { time: '00:30:00' },
        },
      ] as TimesStopsInputRow[];
      const startTime = '2024-08-13T23:50:00';
      const result = updateDaySinceDeparture(TimesStopsInputRows, startTime, true);
      const expected = [
        {
          opId: 'd9c92cb4',
          name: 'Ge',
          uic: 86,
          ch: 'BV',
          arrival: { time: '23:50:00', daySinceDeparture: 0 },
          departure: undefined,
        },
        {
          opId: 'd9b38600',
          name: 'Ge',
          uic: 86,
          ch: 'BX',
          arrival: { time: '00:30:00', daySinceDeparture: 1, dayDisplayed: true },
          departure: undefined,
        },
      ];
      expect(result).toEqual(expected);
    });
    it('should add display flag for the first time in the new day', () => {
      const TimesStopsInputRows = [
        {
          opId: 'd9c92cb4',
          name: 'Ge',
          uic: 86,
          ch: 'BV',
          arrival: { time: '23:50:00' },
        },
        {
          opId: 'd9b38600',
          name: 'Ge',
          uic: 84,
          ch: 'BX',
          arrival: { time: '00:30:00' },
        },
        {
          opId: 'd982df3e',
          name: 'St',
          uic: 82,
          ch: 'BV',
          arrival: undefined,
        },
        {
          opId: 'd982df3e',
          name: 'Vp',
          uic: 78,
          ch: 'BV',
          arrival: { time: '00:50:00' },
        },
      ] as TimesStopsInputRow[];
      const startTime = '2024-08-13T23:50:00';
      const result = updateDaySinceDeparture(TimesStopsInputRows, startTime, true);
      const expected = [
        {
          opId: 'd9c92cb4',
          name: 'Ge',
          uic: 86,
          ch: 'BV',
          arrival: { time: '23:50:00', daySinceDeparture: 0 },
          departure: undefined,
        },
        {
          opId: 'd9b38600',
          name: 'Ge',
          uic: 84,
          ch: 'BX',
          arrival: { time: '00:30:00', daySinceDeparture: 1, dayDisplayed: true },
          departure: undefined,
        },
        {
          opId: 'd982df3e',
          name: 'St',
          uic: 82,
          ch: 'BV',
          arrival: undefined,
          departure: undefined,
        },
        {
          opId: 'd982df3e',
          name: 'Vp',
          uic: 78,
          ch: 'BV',
          arrival: { time: '00:50:00', daySinceDeparture: 1 },
          departure: undefined,
        },
      ];
      expect(result).toEqual(expected);
    });
    it('should handle stop on d+1', () => {
      const TimesStopsInputRows = [
        {
          opId: 'd9c92cb4',
          name: 'Ge',
          uic: 86,
          ch: 'BV',
          arrival: { time: '23:50:00' },
        },
        {
          opId: 'd9b38600',
          name: 'Ge',
          uic: 84,
          ch: 'BX',
          arrival: { time: '23:55:00' },
          stopFor: '3600',
        },
        {
          opId: 'd982df3e',
          name: 'St',
          uic: 82,
          ch: 'BV',
          arrival: { time: '00:56:00' },
        },
      ] as TimesStopsInputRow[];
      const startTime = '2024-08-13T23:50:00';
      const result = updateDaySinceDeparture(TimesStopsInputRows, startTime, true);
      const expected = [
        {
          opId: 'd9c92cb4',
          name: 'Ge',
          uic: 86,
          ch: 'BV',
          arrival: { time: '23:50:00', daySinceDeparture: 0 },
          departure: undefined,
        },
        {
          opId: 'd9b38600',
          name: 'Ge',
          uic: 84,
          ch: 'BX',
          arrival: { time: '23:55:00', daySinceDeparture: 0 },
          departure: { time: '00:55:00', daySinceDeparture: 1, dayDisplayed: true },
          stopFor: '3600',
        },
        {
          opId: 'd982df3e',
          name: 'St',
          uic: 82,
          ch: 'BV',
          arrival: { time: '00:56:00', daySinceDeparture: 1 },
          departure: undefined,
        },
      ];
      expect(result).toEqual(expected);
    });
  });
  describe('3 day span', () => {
    it('should add display flag for the first time in the new day', () => {
      const TimesStopsInputRows = [
        {
          opId: 'd9c92cb4',
          name: 'Ge',
          uic: 86,
          ch: 'BV',
          arrival: { time: '23:50:00' },
        },
        {
          opId: 'd9b38600',
          name: 'Ge',
          uic: 84,
          ch: 'BX',
          arrival: { time: '00:30:00' },
        },
        {
          opId: 'd982df3e',
          name: 'St',
          uic: 82,
          ch: 'BV',
        },
        {
          opId: 'auie',
          name: 'Vp',
          uic: 78,
          ch: 'BV',
          arrival: { time: '00:50:00' },
        },
        {
          opId: 'bépo',
          name: 'Uj',
          uic: 76,
          ch: 'BV',
          arrival: { time: '18:50:00' },
        },
        {
          opId: 'àyx.',
          name: 'Vs',
          uic: 72,
          ch: 'BV',
          arrival: { time: '23:30:00' },
          stopFor: '3600',
        },
      ] as TimesStopsInputRow[];
      const startTime = '2024-08-13T23:50:00';
      const result = updateDaySinceDeparture(TimesStopsInputRows, startTime, true);
      const expected = [
        {
          opId: 'd9c92cb4',
          name: 'Ge',
          uic: 86,
          ch: 'BV',
          arrival: { time: '23:50:00', daySinceDeparture: 0 },
          departure: undefined,
        },
        {
          opId: 'd9b38600',
          name: 'Ge',
          uic: 84,
          ch: 'BX',
          arrival: { time: '00:30:00', daySinceDeparture: 1, dayDisplayed: true },
          departure: undefined,
        },
        {
          opId: 'd982df3e',
          name: 'St',
          uic: 82,
          ch: 'BV',
          arrival: undefined,
          departure: undefined,
        },
        {
          opId: 'auie',
          name: 'Vp',
          uic: 78,
          ch: 'BV',
          arrival: { time: '00:50:00', daySinceDeparture: 1 },
          departure: undefined,
        },
        {
          opId: 'bépo',
          name: 'Uj',
          uic: 76,
          ch: 'BV',
          arrival: { time: '18:50:00', daySinceDeparture: 1 },
          departure: undefined,
        },
        {
          opId: 'àyx.',
          name: 'Vs',
          uic: 72,
          ch: 'BV',
          arrival: { time: '23:30:00', daySinceDeparture: 1 },
          departure: {
            time: '00:30:00',
            daySinceDeparture: 2,
            dayDisplayed: true,
          },
          stopFor: '3600',
        },
      ];
      expect(result).toEqual(expected);
    });
  });
});

describe('durationSinceStartTime', () => {
  it('should return the correct duration', () => {
    const startTime = '2023-09-01T10:00:00Z';
    const stepTimeDays = {
      time: '20:00:00',
      daySinceDeparture: 0,
    };

    const result = durationSinceStartTime(startTime, stepTimeDays);

    expect(result).toBe('PT36000S');
  });

  it('should return the correct duration. daySinceDeparture 1', () => {
    const startTime = '2023-09-01T10:00:00Z';
    const stepTimeDays = {
      time: '11:00:00',
      daySinceDeparture: 1,
    };

    const result = durationSinceStartTime(startTime, stepTimeDays);

    expect(result).toBe('PT90000S');
  });
});

describe('calculateStepTimeDays', () => {
  it('should return correct time and daySinceDeparture', () => {
    const startTime = '2023-09-01T10:00:00Z';
    const isoDuration = 'PT36000S'; // 10 hours

    const result = calculateStepTimeAndDays(startTime, isoDuration);

    expect(result).toEqual({
      time: '20:00:00',
      daySinceDeparture: 0,
    });
  });

  it('should return correct time and daySinceDeparture, daySinceDeparture 1', () => {
    const startTime = '2023-09-01T10:00:00Z';
    const isoDuration = 'PT122400S'; // 1 day 10 hours

    const result = calculateStepTimeAndDays(startTime, isoDuration);

    expect(result).toEqual({
      time: '20:00:00',
      daySinceDeparture: 1,
    });
  });
});
