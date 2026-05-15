import { describe, it, expect } from 'vitest';

import type { IndexedOccurrenceId, PacedTrainId } from 'reducers/osrdconf/types';

import type { CurveStyleInput } from '../../types';
import getCurveVisualState from '../getCurveVisualState';

const PACED_1 = 'paced_1' as PacedTrainId;
const PACED_2 = 'paced_2' as PacedTrainId;
const PACED_1_OCC_2 = 'indexedoccurrence_1_2' as IndexedOccurrenceId;
const PACED_1_OCC_3 = 'indexedoccurrence_1_3' as IndexedOccurrenceId;

const buildInput = (overrides: Partial<CurveStyleInput> = {}): CurveStyleInput => ({
  chart: 'std',
  train: { id: PACED_1 },
  selection: undefined,
  ...overrides,
});

describe('getCurveVisualState', () => {
  describe('A.* - selection from train list', () => {
    it.each(['std', 'tod'] as const)(
      'A.1 - unique train, train is the selected one on %s, it should return passivePrimary',
      (chart) => {
        expect(
          getCurveVisualState(
            buildInput({
              chart,
              train: { id: PACED_1 },
              selection: { id: PACED_1, by: 'timetable' },
            })
          )
        ).toBe('passivePrimary');
      }
    );

    it.each(['std', 'tod'] as const)(
      'A.2 - occurrence selected, train is the target occurrence on %s, it should return passivePrimary',
      (chart) => {
        expect(
          getCurveVisualState(
            buildInput({
              chart,
              train: { id: PACED_1_OCC_2 },
              selection: { id: PACED_1_OCC_2, by: 'timetable' },
            })
          )
        ).toBe('passivePrimary');
      }
    );

    it.each(['std', 'tod'] as const)(
      'A.2 bis - occurrence selected, train is another occurrence of same paced on %s, it should return passiveSecondary',
      (chart) => {
        expect(
          getCurveVisualState(
            buildInput({
              chart,
              train: { id: PACED_1_OCC_3 },
              selection: { id: PACED_1_OCC_2, by: 'timetable' },
            })
          )
        ).toBe('passiveSecondary');
      }
    );

    it.each(['std', 'tod'] as const)(
      'A.3 - paced train selected, train has no start_time exception on %s, it should return passivePrimary',
      (chart) => {
        expect(
          getCurveVisualState(
            buildInput({
              chart,
              train: { id: PACED_1_OCC_2 },
              selection: { id: PACED_1, by: 'timetable' },
            })
          )
        ).toBe('passivePrimary');
      }
    );

    it.each(['std', 'tod'] as const)(
      'A.3 bis - paced train selected, train has a start_time exception on %s, it should return passiveSecondary',
      (chart) => {
        expect(
          getCurveVisualState(
            buildInput({
              chart,
              train: { id: PACED_1_OCC_2, exceptionType: 'start_time' },
              selection: { id: PACED_1, by: 'timetable' },
            })
          )
        ).toBe('passiveSecondary');
      }
    );

    it.each(['std', 'tod'] as const)(
      'train unrelated to the selected paced on %s, it should return none',
      (chart) => {
        expect(
          getCurveVisualState(
            buildInput({
              chart,
              train: { id: PACED_2 },
              selection: { id: PACED_1, by: 'timetable' },
            })
          )
        ).toBe('none');
      }
    );
  });
});
