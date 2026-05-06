import { describe, it, expect } from 'vitest';

import { type TimesStopsInputRow } from 'modules/timesStops/types';
import { Duration } from 'utils/duration';

import {
  updateRowTimesAndMargin,
  updateDaySinceDeparture,
  durationSinceStartTime,
  calculateStepTimeAndDays,
} from '../utils';

const inputRow = ({
  arrival,
  departure,
  stopSeconds,
}: {
  arrival?: string;
  departure?: string;
  stopSeconds?: number;
}) =>
  ({
    opId: 'd94a2af4',
    name: 'Gr',
    arrival: arrival ? { time: arrival } : undefined,
    departure: departure ? { time: departure } : undefined,
    stopFor: stopSeconds ? new Duration({ seconds: stopSeconds }) : undefined,
  }) as TimesStopsInputRow;

describe('updateRowTimesAndMargin', () => {
  const whateverOperation = { fromRowIndex: 2 };

  describe('only the arrival was set beforehand', () => {
    const before = inputRow({ arrival: '10:00:00' });

    describe('on arrival change', () => {
      const after = inputRow({ arrival: '10:05:00' });
      const result = updateRowTimesAndMargin(after, before, whateverOperation, 4);

      it('should change arrival time', () => {
        expect(result.arrival?.time).toEqual('10:05:00');
      });

      it('should keep departure or stop duration empty', () => {
        expect(result.departure?.time).toBe(undefined);
        expect(result.stopFor).toBe(undefined);
      });
    });

    describe('on arrival deletion', () => {
      const after = inputRow({});
      const result = updateRowTimesAndMargin(after, before, whateverOperation, 4);

      it('should remove arrival time', () => {
        expect(result.arrival?.time).toBe(undefined);
      });

      it('should keep departure or stop duration empty', () => {
        expect(result.departure?.time).toBe(undefined);
        expect(result.stopFor).toBe(undefined);
      });
    });

    describe('on stop duration change', () => {
      const after = inputRow({ arrival: '10:00:00', stopSeconds: 120 });
      const result = updateRowTimesAndMargin(after, before, whateverOperation, 4);

      it('should set stop duration', () => {
        expect(result.stopFor).toEqual(new Duration({ seconds: 120 }));
      });

      it('should compute new departure time', () => {
        expect(result.departure?.time).toEqual('10:02:00');
      });

      it('should keep arrival time as it was beforehand', () => {
        expect(result.arrival?.time).toEqual('10:00:00');
      });
    });

    describe('on departure change', () => {
      const after = inputRow({ arrival: '10:00:00', departure: '10:02:00' });
      const result = updateRowTimesAndMargin(after, before, whateverOperation, 4);

      it('should compute new stop duration', () => {
        expect(result.stopFor).toEqual(new Duration({ seconds: 120 }));
      });

      it('should set departure time', () => {
        expect(result.departure?.time).toEqual('10:02:00');
      });

      it('should keep arrival time as it was beforehand', () => {
        expect(result.arrival?.time).toEqual('10:00:00');
      });
    });
  });

  describe('only the stop duration was set beforehand', () => {
    const before = inputRow({ stopSeconds: 60 });

    describe('on stop duration change', () => {
      const after = inputRow({ stopSeconds: 120 });
      const result = updateRowTimesAndMargin(after, before, whateverOperation, 4);

      it('should change stop duration', () => {
        expect(result.stopFor).toEqual(new Duration({ seconds: 120 }));
      });

      it('should keep departure or stop duration empty', () => {
        expect(result.departure?.time).toBe(undefined);
        expect(result.arrival?.time).toBe(undefined);
      });
    });

    describe('on stop duration deletion', () => {
      const after = inputRow({});
      const result = updateRowTimesAndMargin(after, before, whateverOperation, 4);

      it('should remove stop duration', () => {
        expect(result.stopFor).toBe(undefined);
      });
      it('should keep departure or stop duration empty', () => {
        expect(result.departure?.time).toBe(undefined);
        expect(result.arrival?.time).toBe(undefined);
      });
    });
  });

  describe('all arrival, departure and duration stop fields were set beforehand', () => {
    const before = inputRow({ arrival: '10:00:00', departure: '10:01:00', stopSeconds: 60 });

    describe('on arrival change', () => {
      const after = inputRow({ arrival: '10:05:00', departure: '10:01:00', stopSeconds: 60 });
      const result = updateRowTimesAndMargin(after, before, whateverOperation, 4);

      it('should change arrival time', () => {
        expect(result.arrival?.time).toEqual('10:05:00');
      });

      it('should compute new departure time', () => {
        expect(result.departure?.time).toEqual('10:06:00');
      });

      it('should keep stop duration as it was beforehand', () => {
        expect(result.stopFor).toEqual(new Duration({ seconds: 60 }));
      });
    });

    describe('on arrival deletion', () => {
      const after = inputRow({ departure: '10:01:00', stopSeconds: 60 });
      const result = updateRowTimesAndMargin(after, before, whateverOperation, 4);

      it('should remove arrival time', () => {
        expect(result.arrival?.time).toBe(undefined);
      });

      it('should also remove departure time', () => {
        expect(result.departure?.time).toBe(undefined);
      });

      it('should keep the stop duration as it was beforehand', () => {
        expect(result.stopFor).toEqual(new Duration({ seconds: 60 }));
      });
    });

    describe('on stop duration change', () => {
      const after = inputRow({ arrival: '10:00:00', departure: '10:01:00', stopSeconds: 120 });
      const result = updateRowTimesAndMargin(after, before, whateverOperation, 4);

      it('should change stop duration', () => {
        expect(result.stopFor).toEqual(new Duration({ seconds: 120 }));
      });

      it('should compute new departure time', () => {
        expect(result.departure?.time).toEqual('10:02:00');
      });

      it('should keep arrival time as it was beforehand', () => {
        expect(result.arrival?.time).toEqual('10:00:00');
      });
    });

    describe('on stop duration deletion', () => {
      const after = inputRow({ arrival: '10:00:00', departure: '10:01:00' });
      const result = updateRowTimesAndMargin(after, before, whateverOperation, 4);

      it('should remove stop duration', () => {
        expect(result.stopFor).toBe(undefined);
      });

      it('should remove departure time', () => {
        expect(result.departure?.time).toBe(undefined);
      });

      it('should keep arrival time as it was beforehand', () => {
        expect(result.arrival?.time).toEqual('10:00:00');
      });
    });

    describe('on departure change', () => {
      const after = inputRow({ arrival: '10:00:00', departure: '10:02:00', stopSeconds: 60 });
      const result = updateRowTimesAndMargin(after, before, whateverOperation, 4);

      it('should change departure time', () => {
        expect(result.departure?.time).toEqual('10:02:00');
      });

      it('should compute a new stop duration', () => {
        expect(result.stopFor).toEqual(new Duration({ seconds: 120 }));
      });

      it('should keep arrival time as it was beforehand', () => {
        expect(result.arrival?.time).toEqual('10:00:00');
      });
    });

    describe('on departure deletion', () => {
      const after = inputRow({ arrival: '10:00:00', stopSeconds: 60 });
      const result = updateRowTimesAndMargin(after, before, whateverOperation, 4);

      it('should delete departure time', () => {
        expect(result.departure?.time).toBe(undefined);
      });

      it('should also delete arrival time', () => {
        expect(result.arrival?.time).toBe(undefined);
      });

      it('should keep stop duration as it was beforehand', () => {
        expect(result.stopFor).toEqual(new Duration({ seconds: 60 }));
      });
    });
  });

  describe('arrival is set, departure just changed', () => {
    it('should update stop duration from the arrival and departure', () => {
      const rowData = {
        opId: 'd94a2af4',
        name: 'Gr',
        arrival: { time: '23:40:00' },
        departure: { time: '23:50:00' },
        stopFor: new Duration({ seconds: 300 }), // no longer correct, not yet updated by the function
      } as TimesStopsInputRow;
      const previousRowData = {
        opId: 'd94a2af4',
        name: 'Gr',
        arrival: { time: '23:40:00' },
        departure: { time: '23:45:00' },
        stopFor: new Duration({ seconds: 300 }),
      } as TimesStopsInputRow;
      const result = updateRowTimesAndMargin(rowData, previousRowData, whateverOperation, 4);
      expect(result).toEqual({
        opId: 'd94a2af4',
        name: 'Gr',
        arrival: { time: '23:40:00' },
        departure: { time: '23:50:00' },
        stopFor: new Duration({ seconds: 600 }), // now correct with the new arrival and departure
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
        onStopSignal: undefined,
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
        stopFor: new Duration({ seconds: 300 }),
      } as TimesStopsInputRow;
      const previousRowData = {
        opId: 'd94a2af4',
        name: 'Gr',
        arrival: { time: '23:40:00' },
        departure: { time: '23:45:00' },
        stopFor: new Duration({ seconds: 300 }),
      } as TimesStopsInputRow;
      const result = updateRowTimesAndMargin(rowData, previousRowData, whateverOperation, 4);
      expect(result).toEqual({
        opId: 'd94a2af4',
        name: 'Gr',
        arrival: { time: '23:40:00' },
        departure: { time: '00:20:00' },
        stopFor: new Duration({ seconds: 2400 }),
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
        stopFor: new Duration({ seconds: 600 }),
      } as TimesStopsInputRow;
      const previousRowData = {
        opId: 'd94a2af4',
        name: 'Gr',
        arrival: { time: '00:10:00' },
        departure: { time: '00:20:00' },
        stopFor: new Duration({ seconds: 600 }),
      } as TimesStopsInputRow;
      const result = updateRowTimesAndMargin(rowData, previousRowData, whateverOperation, 4);
      expect(result).toEqual({
        opId: 'd94a2af4',
        name: 'Gr',
        arrival: undefined,
        departure: undefined,
        stopFor: new Duration({ seconds: 600 }),
        isMarginValid: true,
      });
    });
    it('should keep stopFor and remove departure (double click + delete button version', () => {
      const rowData = {
        opId: 'd94a2af4',
        name: 'Gr',
        arrival: { time: '' },
        departure: { time: '00:20:00' },
        stopFor: new Duration({ seconds: 600 }),
      } as TimesStopsInputRow;
      const previousRowData = {
        opId: 'd94a2af4',
        name: 'Gr',
        arrival: { time: '00:10:00' },
        departure: { time: '00:20:00' },
        stopFor: new Duration({ seconds: 600 }),
      } as TimesStopsInputRow;
      const result = updateRowTimesAndMargin(rowData, previousRowData, whateverOperation, 4);
      expect(result).toEqual({
        opId: 'd94a2af4',
        name: 'Gr',
        arrival: undefined,
        departure: undefined,
        stopFor: new Duration({ seconds: 600 }),
        isMarginValid: true,
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
        stopFor: new Duration({ seconds: 600 }),
      } as TimesStopsInputRow;
      const previousRowData = {
        opId: 'd94a2af4',
        name: 'Gr',
        arrival: undefined,
        departure: undefined,
        stopFor: new Duration({ seconds: 600 }),
      } as TimesStopsInputRow;
      const result = updateRowTimesAndMargin(rowData, previousRowData, whateverOperation, 4);
      expect(result).toEqual({
        opId: 'd94a2af4',
        name: 'Gr',
        arrival: { time: '00:10:00' },
        departure: { time: '00:20:00' },
        stopFor: new Duration({ seconds: 600 }),
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
          secondaryCode: 'BV',
          arrival: { time: '10:00:00' },
        },
      ] as TimesStopsInputRow[];
      const result = updateDaySinceDeparture(TimesStopsInputRows, {
        keepFirstIndexArrival: true,
      });
      const expected = [
        {
          opId: 'd9c92cb4',
          name: 'Ge',
          uic: 86,
          secondaryCode: 'BV',
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
          secondaryCode: 'BV',
          arrival: { time: '10:00:00' },
        },
        {
          opId: 'd9c92cb4',
          name: 'Ge',
          uic: 86,
          secondaryCode: 'BX',
          arrival: { time: '11:00:00' },
          stopFor: new Duration({ seconds: 1800 }),
        },
      ] as TimesStopsInputRow[];
      const result = updateDaySinceDeparture(TimesStopsInputRows, {
        keepFirstIndexArrival: true,
      });
      const expected = [
        {
          opId: 'd9c92cb4',
          name: 'Ge',
          uic: 86,
          secondaryCode: 'BV',
          arrival: { time: '10:00:00', daySinceDeparture: 0 },
          departure: undefined,
        },
        {
          opId: 'd9c92cb4',
          name: 'Ge',
          uic: 86,
          secondaryCode: 'BX',
          arrival: { time: '11:00:00', daySinceDeparture: 0 },
          departure: { time: '11:30:00', daySinceDeparture: 0 },
          stopFor: new Duration({ seconds: 1800 }),
        },
      ];
      expect(result).toEqual(expected);
    });
    it('should handle departure exactly at midnight', () => {
      const pathWaypointRows = [
        {
          opId: 'd9a382bc',
          name: 'St',
          uic: 75,
          secondaryCode: 'BV',
          arrival: { time: '00:00:00' },
        },
        {
          opId: 'd9b38600',
          name: 'Ge',
          uic: 86,
          secondaryCode: 'BX',
          arrival: { time: '01:00:00' },
        },
      ] as TimesStopsInputRow[];
      const result = updateDaySinceDeparture(pathWaypointRows, {
        keepFirstIndexArrival: true,
      });
      const expected = [
        {
          opId: 'd9a382bc',
          name: 'St',
          uic: 75,
          secondaryCode: 'BV',
          arrival: { time: '00:00:00', daySinceDeparture: 0 },
          departure: undefined,
        },
        {
          opId: 'd9b38600',
          name: 'Ge',
          uic: 86,
          secondaryCode: 'BX',
          arrival: { time: '01:00:00', daySinceDeparture: 0 },
          departure: undefined,
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
          secondaryCode: 'BV',
          arrival: { time: '23:50:00' },
        },
        {
          opId: 'd9b38600',
          name: 'Ge',
          uic: 86,
          secondaryCode: 'BX',
          arrival: { time: '00:30:00' },
        },
      ] as TimesStopsInputRow[];
      const result = updateDaySinceDeparture(TimesStopsInputRows, {
        keepFirstIndexArrival: true,
      });
      const expected = [
        {
          opId: 'd9c92cb4',
          name: 'Ge',
          uic: 86,
          secondaryCode: 'BV',
          arrival: { time: '23:50:00', daySinceDeparture: 0 },
          departure: undefined,
        },
        {
          opId: 'd9b38600',
          name: 'Ge',
          uic: 86,
          secondaryCode: 'BX',
          arrival: { time: '00:30:00', daySinceDeparture: 1, dayDisplayed: true },
          departure: undefined,
        },
      ];
      expect(result).toEqual(expected);
    });
    it('should handle exactly midnight', () => {
      const pathWaypointRows = [
        {
          opId: 'd9c92cb4',
          name: 'Ge',
          uic: 86,
          secondaryCode: 'BV',
          arrival: { time: '23:50:00' },
        },
        {
          opId: 'd9b38600',
          name: 'Ge',
          uic: 86,
          secondaryCode: 'BX',
          arrival: { time: '00:00:00' },
        },
      ] as TimesStopsInputRow[];
      const result = updateDaySinceDeparture(pathWaypointRows, {
        keepFirstIndexArrival: true,
      });
      const expected = [
        {
          opId: 'd9c92cb4',
          name: 'Ge',
          uic: 86,
          secondaryCode: 'BV',
          arrival: { time: '23:50:00', daySinceDeparture: 0 },
          departure: undefined,
        },
        {
          opId: 'd9b38600',
          name: 'Ge',
          uic: 86,
          secondaryCode: 'BX',
          arrival: { time: '00:00:00', daySinceDeparture: 1, dayDisplayed: true },
          departure: undefined,
        },
      ];
      expect(result).toEqual(expected);
    });
    it('should handle a waypoint exactly at midnight in the middle', () => {
      const pathWaypointRows = [
        {
          opId: 'd9a382bc',
          name: 'St',
          uic: 75,
          secondaryCode: 'BV',
          arrival: { time: '23:45:00' },
        },
        {
          opId: 'd9b38600',
          name: 'Ge',
          uic: 86,
          secondaryCode: 'BX',
          arrival: { time: '00:00:00' },
        },
        {
          opId: 'd9a382bd',
          name: 'Fr',
          uic: 87,
          secondaryCode: 'BY',
          arrival: { time: '01:30:00' },
        },
      ] as TimesStopsInputRow[];
      const result = updateDaySinceDeparture(pathWaypointRows, {
        keepFirstIndexArrival: true,
      });
      const expected = [
        {
          opId: 'd9a382bc',
          name: 'St',
          uic: 75,
          secondaryCode: 'BV',
          arrival: { time: '23:45:00', daySinceDeparture: 0 },
          departure: undefined,
        },
        {
          opId: 'd9b38600',
          name: 'Ge',
          uic: 86,
          secondaryCode: 'BX',
          arrival: { time: '00:00:00', daySinceDeparture: 1, dayDisplayed: true },
          departure: undefined,
        },
        {
          opId: 'd9a382bd',
          name: 'Fr',
          uic: 87,
          secondaryCode: 'BY',
          arrival: { time: '01:30:00', daySinceDeparture: 1 },
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
          secondaryCode: 'BV',
          arrival: { time: '23:50:00' },
        },
        {
          opId: 'd9b38600',
          name: 'Ge',
          uic: 84,
          secondaryCode: 'BX',
          arrival: { time: '00:30:00' },
        },
        {
          opId: 'd982df3e',
          name: 'St',
          uic: 82,
          secondaryCode: 'BV',
          arrival: undefined,
        },
        {
          opId: 'd982df3e',
          name: 'Vp',
          uic: 78,
          secondaryCode: 'BV',
          arrival: { time: '00:50:00' },
        },
      ] as TimesStopsInputRow[];
      const result = updateDaySinceDeparture(TimesStopsInputRows, {
        keepFirstIndexArrival: true,
      });
      const expected = [
        {
          opId: 'd9c92cb4',
          name: 'Ge',
          uic: 86,
          secondaryCode: 'BV',
          arrival: { time: '23:50:00', daySinceDeparture: 0 },
          departure: undefined,
        },
        {
          opId: 'd9b38600',
          name: 'Ge',
          uic: 84,
          secondaryCode: 'BX',
          arrival: { time: '00:30:00', daySinceDeparture: 1, dayDisplayed: true },
          departure: undefined,
        },
        {
          opId: 'd982df3e',
          name: 'St',
          uic: 82,
          secondaryCode: 'BV',
          arrival: undefined,
          departure: undefined,
        },
        {
          opId: 'd982df3e',
          name: 'Vp',
          uic: 78,
          secondaryCode: 'BV',
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
          secondaryCode: 'BV',
          arrival: { time: '23:50:00' },
        },
        {
          opId: 'd9b38600',
          name: 'Ge',
          uic: 84,
          secondaryCode: 'BX',
          arrival: { time: '23:55:00' },
          stopFor: new Duration({ seconds: 3600 }),
        },
        {
          opId: 'd982df3e',
          name: 'St',
          uic: 82,
          secondaryCode: 'BV',
          arrival: { time: '00:56:00' },
        },
      ] as TimesStopsInputRow[];
      const result = updateDaySinceDeparture(TimesStopsInputRows, {
        keepFirstIndexArrival: true,
      });
      const expected = [
        {
          opId: 'd9c92cb4',
          name: 'Ge',
          uic: 86,
          secondaryCode: 'BV',
          arrival: { time: '23:50:00', daySinceDeparture: 0 },
          departure: undefined,
        },
        {
          opId: 'd9b38600',
          name: 'Ge',
          uic: 84,
          secondaryCode: 'BX',
          arrival: { time: '23:55:00', daySinceDeparture: 0 },
          departure: { time: '00:55:00', daySinceDeparture: 1, dayDisplayed: true },
          stopFor: new Duration({ seconds: 3600 }),
        },
        {
          opId: 'd982df3e',
          name: 'St',
          uic: 82,
          secondaryCode: 'BV',
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
          secondaryCode: 'BV',
          arrival: { time: '23:50:00' },
        },
        {
          opId: 'd9b38600',
          name: 'Ge',
          uic: 84,
          secondaryCode: 'BX',
          arrival: { time: '00:30:00' },
        },
        {
          opId: 'd982df3e',
          name: 'St',
          uic: 82,
          secondaryCode: 'BV',
        },
        {
          opId: 'auie',
          name: 'Vp',
          uic: 78,
          secondaryCode: 'BV',
          arrival: { time: '00:50:00' },
        },
        {
          opId: 'bépo',
          name: 'Uj',
          uic: 76,
          secondaryCode: 'BV',
          arrival: { time: '18:50:00' },
        },
        {
          opId: 'àyx.',
          name: 'Vs',
          uic: 72,
          secondaryCode: 'BV',
          arrival: { time: '23:30:00' },
          stopFor: new Duration({ seconds: 3600 }),
        },
      ] as TimesStopsInputRow[];
      const result = updateDaySinceDeparture(TimesStopsInputRows, {
        keepFirstIndexArrival: true,
      });
      const expected = [
        {
          opId: 'd9c92cb4',
          name: 'Ge',
          uic: 86,
          secondaryCode: 'BV',
          arrival: { time: '23:50:00', daySinceDeparture: 0 },
          departure: undefined,
        },
        {
          opId: 'd9b38600',
          name: 'Ge',
          uic: 84,
          secondaryCode: 'BX',
          arrival: { time: '00:30:00', daySinceDeparture: 1, dayDisplayed: true },
          departure: undefined,
        },
        {
          opId: 'd982df3e',
          name: 'St',
          uic: 82,
          secondaryCode: 'BV',
          arrival: undefined,
          departure: undefined,
        },
        {
          opId: 'auie',
          name: 'Vp',
          uic: 78,
          secondaryCode: 'BV',
          arrival: { time: '00:50:00', daySinceDeparture: 1 },
          departure: undefined,
        },
        {
          opId: 'bépo',
          name: 'Uj',
          uic: 76,
          secondaryCode: 'BV',
          arrival: { time: '18:50:00', daySinceDeparture: 1 },
          departure: undefined,
        },
        {
          opId: 'àyx.',
          name: 'Vs',
          uic: 72,
          secondaryCode: 'BV',
          arrival: { time: '23:30:00', daySinceDeparture: 1 },
          departure: {
            time: '00:30:00',
            daySinceDeparture: 2,
            dayDisplayed: true,
          },
          stopFor: new Duration({ seconds: 3600 }),
        },
      ];
      expect(result).toEqual(expected);
    });
    it('should handle a three-day span with two midnights', () => {
      const pathWaypointRows = [
        {
          opId: 'd9a382bc',
          name: 'St',
          uic: 75,
          secondaryCode: 'BV',
          arrival: { time: '23:45:00' },
        },
        {
          opId: 'd9b38600',
          name: 'Ge',
          uic: 86,
          secondaryCode: 'BX',
          arrival: { time: '00:00:00' },
        },
        {
          opId: 'd9a382bd',
          name: 'Fr',
          uic: 87,
          secondaryCode: 'BY',
          arrival: { time: '01:30:00' },
        },
        {
          opId: 'd9a382be',
          name: 'Lm',
          uic: 88,
          secondaryCode: 'BZ',
          arrival: { time: '23:50:00' },
        },
        {
          opId: 'd9a382bf',
          name: 'Nc',
          uic: 89,
          secondaryCode: 'CA',
          arrival: { time: '00:00:00' },
        },
        {
          opId: 'd9a382c0',
          name: 'Po',
          uic: 90,
          secondaryCode: 'CB',
          arrival: { time: '03:00:00' },
        },
      ] as TimesStopsInputRow[];

      const result = updateDaySinceDeparture(pathWaypointRows, {
        keepFirstIndexArrival: true,
      });

      const expected = [
        {
          opId: 'd9a382bc',
          name: 'St',
          uic: 75,
          secondaryCode: 'BV',
          arrival: { time: '23:45:00', daySinceDeparture: 0 },
          departure: undefined,
        },
        {
          opId: 'd9b38600',
          name: 'Ge',
          uic: 86,
          secondaryCode: 'BX',
          arrival: { time: '00:00:00', daySinceDeparture: 1, dayDisplayed: true },
          departure: undefined,
        },
        {
          opId: 'd9a382bd',
          name: 'Fr',
          uic: 87,
          secondaryCode: 'BY',
          arrival: { time: '01:30:00', daySinceDeparture: 1 },
          departure: undefined,
        },
        {
          opId: 'd9a382be',
          name: 'Lm',
          uic: 88,
          secondaryCode: 'BZ',
          arrival: { time: '23:50:00', daySinceDeparture: 1 },
          departure: undefined,
        },
        {
          opId: 'd9a382bf',
          name: 'Nc',
          uic: 89,
          secondaryCode: 'CA',
          arrival: { time: '00:00:00', daySinceDeparture: 2, dayDisplayed: true },
          departure: undefined,
        },
        {
          opId: 'd9a382c0',
          name: 'Po',
          uic: 90,
          secondaryCode: 'CB',
          arrival: { time: '03:00:00', daySinceDeparture: 2 },
          departure: undefined,
        },
      ];
      expect(result).toEqual(expected);
    });
  });
});

describe('durationSinceStartTime', () => {
  it('should return the correct duration', () => {
    const startTime = new Date('2023-09-01T10:00:00Z');
    const stepTimeDays = {
      time: '20:00:00',
      daySinceDeparture: 0,
    };

    const result = durationSinceStartTime(startTime, stepTimeDays);

    expect(result).toEqual(Duration.parse('PT36000S'));
  });

  it('should return the correct duration. daySinceDeparture 1', () => {
    const startTime = new Date('2023-09-01T10:00:00Z');
    const stepTimeDays = {
      time: '11:00:00',
      daySinceDeparture: 1,
    };

    const result = durationSinceStartTime(startTime, stepTimeDays);

    expect(result).toEqual(Duration.parse('PT90000S'));
  });
});

describe('calculateStepTimeDays', () => {
  it('should return correct time and daySinceDeparture', () => {
    const startTime = new Date('2023-09-01T10:00:00Z');
    const isoDuration = Duration.parse('PT36000S'); // 10 hours

    const result = calculateStepTimeAndDays(startTime, isoDuration);

    expect(result).toEqual({
      time: '20:00:00',
      daySinceDeparture: 0,
    });
  });

  it('should return correct time and daySinceDeparture, daySinceDeparture 1', () => {
    const startTime = new Date('2023-09-01T10:00:00Z');
    const isoDuration = Duration.parse('PT122400S'); // 1 day 10 hours

    const result = calculateStepTimeAndDays(startTime, isoDuration);

    expect(result).toEqual({
      time: '20:00:00',
      daySinceDeparture: 1,
    });
  });
});
