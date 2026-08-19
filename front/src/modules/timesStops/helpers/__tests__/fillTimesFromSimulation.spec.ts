import { describe, it, expect } from 'vitest';

import type { TimesStopsRowNew } from '../../types';
import { getRowsToUpdateFromSimulation } from '../fillTimesFromSimulation';

const _10H00 = new Date('2025-01-01T10:00:00Z');
const _10H30 = new Date('2025-01-01T10:30:00Z');

const buildRow = (overrides: Partial<TimesStopsRowNew> = {}): TimesStopsRowNew => ({
  id: 'row-1',
  pathStepId: 'step-1',
  opOnPathIndex: 0,
  stepStatus: 'allHonored',
  name: 'Some station',
  track: 'track',
  hasRequestedTrack: false,
  location: {} as TimesStopsRowNew['location'],
  requestedArrival: null,
  computedArrival: _10H00,
  stopDuration: null,
  requestedDeparture: null,
  computedDeparture: _10H30,
  powerRestriction: null,
  requestedTheoreticalMargin: undefined,
  isTheoreticalMarginBoundary: undefined,
  computedTheoreticalMarginSeconds: undefined,
  realMargin: undefined,
  marginsDifference: undefined,
  timeFromPreviousOp: null,
  totalTravelTime: null,
  ...overrides,
});

describe('getRowsToUpdateFromSimulation', () => {
  it('excludes rows without a pathStepId', () => {
    const rows = [buildRow({ pathStepId: null })];

    expect(getRowsToUpdateFromSimulation(rows, 'requestedArrival', 'fill')).toEqual([]);
  });

  it('excludes rows without a computed value for the target field', () => {
    const rows = [buildRow({ computedArrival: null })];

    expect(getRowsToUpdateFromSimulation(rows, 'requestedArrival', 'fill')).toEqual([]);
    expect(getRowsToUpdateFromSimulation(rows, 'requestedArrival', 'overwrite')).toEqual([]);
  });

  describe('fill mode', () => {
    it('includes rows whose requested field is null', () => {
      const rows = [buildRow({ requestedArrival: null })];

      expect(getRowsToUpdateFromSimulation(rows, 'requestedArrival', 'fill')).toEqual(rows);
    });

    it('excludes rows whose requested field is already set', () => {
      const rows = [buildRow({ requestedArrival: _10H00 })];

      expect(getRowsToUpdateFromSimulation(rows, 'requestedArrival', 'fill')).toEqual([]);
    });
  });

  describe('overwrite mode', () => {
    it('includes rows regardless of an existing requested value', () => {
      const rows = [buildRow({ requestedArrival: _10H00 })];

      expect(getRowsToUpdateFromSimulation(rows, 'requestedArrival', 'overwrite')).toEqual(rows);
    });

    it('includes rows whose requested field is null', () => {
      const rows = [buildRow({ requestedArrival: null })];

      expect(getRowsToUpdateFromSimulation(rows, 'requestedArrival', 'overwrite')).toEqual(rows);
    });
  });
});
