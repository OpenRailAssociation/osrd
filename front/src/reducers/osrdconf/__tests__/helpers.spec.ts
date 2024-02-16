import { computeLinkedOriginTimes, insertVia } from '../helpers';

describe('computeLinkedOriginTimes', () => {
  describe('should throw error', () => {
    it('should throw error if no new time is provided', () => {
      expect(() =>
        computeLinkedOriginTimes(
          '2023-11-22',
          '08:00:00',
          '2023-11-22',
          '10:00:00',
          undefined,
          undefined
        )
      ).toThrow(new Error('One of newOriginTime or newOriginUpperBoundTime must be provided'));
    });

    it('should throw error if 2 new times are provided', () => {
      expect(() =>
        computeLinkedOriginTimes(
          '2023-11-22',
          '08:00:00',
          '2023-11-22',
          '10:00:00',
          '14:00:00',
          '16:00:00'
        )
      ).toThrow(new Error('Both newOriginTime and newOriginUpperBoundTime are provided'));
    });
  });

  describe('should manage new origin time', () => {
    it('should not update originUpperBoundDate', () => {
      const result = computeLinkedOriginTimes(
        '2023-11-22',
        '08:00:00',
        '2023-11-22',
        '10:00:00',
        '14:00:00'
      );
      expect(result).toEqual({
        newOriginTime: '14:00:00',
        newOriginUpperBoundTime: '16:00:00',
        newOriginUpperBoundDate: null,
      });
    });

    it('should set originUpperBoundDate to the day after originDate', () => {
      const result = computeLinkedOriginTimes(
        '2023-11-22',
        '08:00:00',
        '2023-11-22',
        '10:00:00',
        '23:00:00'
      );
      expect(result).toEqual({
        newOriginTime: '23:00:00',
        newOriginUpperBoundTime: '01:00:00',
        newOriginUpperBoundDate: '2023-11-23',
      });
    });

    it('should set originUpperBoundDate equal to originDate', () => {
      const result = computeLinkedOriginTimes(
        '2023-11-22',
        '23:00:00',
        '2023-11-23',
        '01:00:00',
        '09:00:00'
      );
      expect(result).toEqual({
        newOriginTime: '09:00:00',
        newOriginUpperBoundTime: '11:00:00',
        newOriginUpperBoundDate: '2023-11-22',
      });
    });
  });

  describe('should manage new origin upper bound time', () => {
    it('should not update originUpperBoundDate', () => {
      const result = computeLinkedOriginTimes(
        '2023-11-22',
        '08:00:00',
        '2023-11-22',
        '10:00:00',
        undefined,
        '14:00:00'
      );
      expect(result).toEqual({
        newOriginTime: '12:00:00',
        newOriginUpperBoundTime: '14:00:00',
        newOriginUpperBoundDate: null,
      });
    });

    it('should set originUpperBoundDate to the day after originDate', () => {
      const result = computeLinkedOriginTimes(
        '2023-11-22',
        '08:00:00',
        '2023-11-22',
        '10:00:00',
        undefined,
        '01:00:00'
      );
      expect(result).toEqual({
        newOriginTime: '23:00:00',
        newOriginUpperBoundTime: '01:00:00',
        newOriginUpperBoundDate: '2023-11-23',
      });
    });

    it('should set originUpperBoundDate equal to originDate', () => {
      const result = computeLinkedOriginTimes(
        '2023-11-22',
        '23:00:00',
        '2023-11-23',
        '01:00:00',
        undefined,
        '23:30:00'
      );
      expect(result).toEqual({
        newOriginTime: '21:30:00',
        newOriginUpperBoundTime: '23:30:00',
        newOriginUpperBoundDate: '2023-11-22',
      });
    });
  });
});

describe('insertVias', () => {
  const brest = { coordinates: [-4.486076, 48.390394] };
  const strasbourg = { coordinates: [7.750713, 48.583148] };
  const mans = { coordinates: [0.199556, 48.00611] };
  const rennes = { coordinates: [-1.677793, 48.117266] };
  const nancy = { coordinates: [6.184417, 48.693722] };

  it('should insert a new via at the beginning of the route', () => {
    expect(insertVia([mans], brest, strasbourg, rennes)).toEqual([rennes, mans]);
  });

  it('should insert a via in the middle of the route', () => {
    expect(insertVia([rennes, nancy], brest, strasbourg, mans)).toEqual([rennes, mans, nancy]);
  });

  it('should insert a via at the end of the route', () => {
    expect(insertVia([rennes], brest, strasbourg, nancy)).toEqual([rennes, nancy]);
  });

  it('should handle insertion for a route with no existing stops', () => {
    expect(insertVia([], brest, strasbourg, nancy)).toEqual([nancy]);
  });
});
