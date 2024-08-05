import type { PathWaypointRow } from 'modules/timesStops/types';
import { transformRowDataOnChange } from '../utils';


describe('transformRowDataOnChange', () => {
  const whateverOperation = { fromRowIndex: 2 };

  describe('arrival is set, departure just changed', () => {
    it('should update stop duration from the arrival and departure', () => {
      const rowData = {
        opId: 'd94a2af4-6667-11e3-89ff-01f464e0362d',
        name: 'Gr',
        arrival: '23:40:00',
        departure: '23:50:00',
        stopFor: '300', // no longer correct, not yet updated by the function
      } as PathWaypointRow;
      const previousRowData = {
        opId: 'd94a2af4-6667-11e3-89ff-01f464e0362d',
        name: 'Gr',
        arrival: '23:40:00',
        departure: '23:45:00',
        stopFor: '300',
      } as PathWaypointRow;
      const result = transformRowDataOnChange(rowData, previousRowData, whateverOperation, 4);
      expect(result).toEqual({
        opId: 'd94a2af4-6667-11e3-89ff-01f464e0362d',
        name: 'Gr',
        arrival: '23:40:00',
        departure: '23:50:00',
        stopFor: '600', // now correct with the new arrival and departure
        isMarginValid: true,
      });
    });
  });
  describe('theoritical margin is incorrect', () => {
    it('should set isMarginValid flag to false', () => {
      const rowData = {
        opId: 'd94a2af4-6667-11e3-89ff-01f464e0362d',
        name: 'Gr',
        theoreticalMargin: '10',
      } as PathWaypointRow;
      const previousRowData = {
        opId: 'd94a2af4-6667-11e3-89ff-01f464e0362d',
        name: 'Gr',
      } as PathWaypointRow;
      const result = transformRowDataOnChange(rowData, previousRowData, whateverOperation, 4);
      expect(result.isMarginValid).toBe(false);
    });
  });
  describe('user removed first row theoritical margin', () => {
    it('should set the theoritical margin back to 0%', () => {
      const rowData = {
        opId: 'd94a2af4-6667-11e3-89ff-01f464e0362d',
        name: 'Gr',
      } as PathWaypointRow;
      const previousRowData = {
        opId: 'd94a2af4-6667-11e3-89ff-01f464e0362d',
        name: 'Gr',
        theoreticalMargin: '10%',
      } as PathWaypointRow;
      const operation = {
        fromRowIndex: 0,
      };
      const result = transformRowDataOnChange(rowData, previousRowData, operation, 4);
      expect(result).toEqual({
        opId: 'd94a2af4-6667-11e3-89ff-01f464e0362d',
        name: 'Gr',
        arrival: null,
        isMarginValid: true,
        onStopSignal: false,
        theoreticalMargin: '0%',
      });
    });
  });
});
