import { describe, it, expect } from 'vitest';

import type { IndexedOccurrenceId, PacedTrainId } from 'reducers/osrdconf/types';

import type { CurveStyleInput } from '../../types';
import getCurveVisualState from '../getCurveVisualState';

const PACED_1 = 'paced_1' as PacedTrainId;
const PACED_2 = 'paced_2' as PacedTrainId;
const PACED_1_OCC_2 = 'indexedoccurrence_1_2' as IndexedOccurrenceId;
const PACED_1_OCC_3 = 'indexedoccurrence_1_3' as IndexedOccurrenceId;
const PACED_2_OCC_1 = 'indexedoccurrence_2_1' as IndexedOccurrenceId;

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

  describe('B.* - selection from STD', () => {
    // B.6 is covered by the B.3 tests: the helper sees the same inputs in both cases.
    // B.7 is not tested here: the dispatch resets `by` to 'timetable', so the helper
    // falls back to the A.* rules.

    it('B.1 - unique train, train is the selected one on std, it should return active', () => {
      expect(
        getCurveVisualState(
          buildInput({
            chart: 'std',
            train: { id: PACED_1 },
            selection: { id: PACED_1, by: 'std' },
          })
        )
      ).toBe('active');
    });

    it('B.1 bis - unique train, train is the selected one on tod, it should return passivePrimary', () => {
      expect(
        getCurveVisualState(
          buildInput({
            chart: 'tod',
            train: { id: PACED_1 },
            selection: { id: PACED_1, by: 'std' },
          })
        )
      ).toBe('passivePrimary');
    });

    it('B.2 - compliant, train without start_time exception on std, it should return active', () => {
      expect(
        getCurveVisualState(
          buildInput({
            chart: 'std',
            train: { id: PACED_1_OCC_2 },
            selection: { id: PACED_1, by: 'std' },
            panelMode: 'compliant',
          })
        )
      ).toBe('active');
    });

    it('B.2 bis - compliant, train without start_time exception on tod, it should return passivePrimary', () => {
      expect(
        getCurveVisualState(
          buildInput({
            chart: 'tod',
            train: { id: PACED_1_OCC_2 },
            selection: { id: PACED_1, by: 'std' },
            panelMode: 'compliant',
          })
        )
      ).toBe('passivePrimary');
    });

    it('B.2 ter - compliant, train with start_time exception on std, it should return passiveSecondary', () => {
      expect(
        getCurveVisualState(
          buildInput({
            chart: 'std',
            train: { id: PACED_1_OCC_2, exceptionType: 'start_time' },
            selection: { id: PACED_1, by: 'std' },
            panelMode: 'compliant',
          })
        )
      ).toBe('passiveSecondary');
    });

    it('B.2 quater - compliant, train with start_time exception on tod, it should return none', () => {
      expect(
        getCurveVisualState(
          buildInput({
            chart: 'tod',
            train: { id: PACED_1_OCC_2, exceptionType: 'start_time' },
            selection: { id: PACED_1, by: 'std' },
            panelMode: 'compliant',
          })
        )
      ).toBe('none');
    });

    it('B.3 - single, last clicked occurrence on std, it should return active', () => {
      expect(
        getCurveVisualState(
          buildInput({
            chart: 'std',
            train: { id: PACED_1_OCC_2 },
            selection: { id: PACED_1_OCC_2, by: 'std' },
            panelMode: 'single',
          })
        )
      ).toBe('active');
    });

    it('B.3 bis - single, last clicked occurrence on tod, it should return passivePrimary', () => {
      expect(
        getCurveVisualState(
          buildInput({
            chart: 'tod',
            train: { id: PACED_1_OCC_2 },
            selection: { id: PACED_1_OCC_2, by: 'std' },
            panelMode: 'single',
          })
        )
      ).toBe('passivePrimary');
    });

    it('B.3 ter - single, other occurrence of same paced on std, it should return passiveSecondary', () => {
      expect(
        getCurveVisualState(
          buildInput({
            chart: 'std',
            train: { id: PACED_1_OCC_3 },
            selection: { id: PACED_1_OCC_2, by: 'std' },
            panelMode: 'single',
          })
        )
      ).toBe('passiveSecondary');
    });

    it('B.3 quater - single, other occurrence of same paced on tod, it should return none', () => {
      expect(
        getCurveVisualState(
          buildInput({
            chart: 'tod',
            train: { id: PACED_1_OCC_3 },
            selection: { id: PACED_1_OCC_2, by: 'std' },
            panelMode: 'single',
          })
        )
      ).toBe('none');
    });

    it('B.4 - single, self with start_time exception on std, it should return active', () => {
      expect(
        getCurveVisualState(
          buildInput({
            chart: 'std',
            train: { id: PACED_1_OCC_2, exceptionType: 'start_time' },
            selection: { id: PACED_1_OCC_2, by: 'std' },
            panelMode: 'single',
          })
        )
      ).toBe('active');
    });

    it('B.4 bis - single, self with start_time exception on tod, it should return passivePrimary', () => {
      expect(
        getCurveVisualState(
          buildInput({
            chart: 'tod',
            train: { id: PACED_1_OCC_2, exceptionType: 'start_time' },
            selection: { id: PACED_1_OCC_2, by: 'std' },
            panelMode: 'single',
          })
        )
      ).toBe('passivePrimary');
    });

    it('B.4 ter - single, other occurrence of same paced on std, it should return passiveSecondary', () => {
      expect(
        getCurveVisualState(
          buildInput({
            chart: 'std',
            train: { id: PACED_1_OCC_3 },
            selection: { id: PACED_1_OCC_2, by: 'std' },
            panelMode: 'single',
          })
        )
      ).toBe('passiveSecondary');
    });

    it('B.4 quater - single, other occurrence of same paced on tod, it should return none', () => {
      expect(
        getCurveVisualState(
          buildInput({
            chart: 'tod',
            train: { id: PACED_1_OCC_3 },
            selection: { id: PACED_1_OCC_2, by: 'std' },
            panelMode: 'single',
          })
        )
      ).toBe('none');
    });

    it('B.5 - all, any occurrence of same paced on std, it should return active', () => {
      expect(
        getCurveVisualState(
          buildInput({
            chart: 'std',
            train: { id: PACED_1_OCC_2 },
            selection: { id: PACED_1, by: 'std' },
            panelMode: 'all',
          })
        )
      ).toBe('active');
    });

    it('B.5 - all also applies to an occurrence with a start_time exception on std, it should return active', () => {
      expect(
        getCurveVisualState(
          buildInput({
            chart: 'std',
            train: { id: PACED_1_OCC_2, exceptionType: 'start_time' },
            selection: { id: PACED_1, by: 'std' },
            panelMode: 'all',
          })
        )
      ).toBe('active');
    });

    it('B.5 bis - all, any occurrence of same paced on tod, it should return passivePrimary', () => {
      expect(
        getCurveVisualState(
          buildInput({
            chart: 'tod',
            train: { id: PACED_1_OCC_2 },
            selection: { id: PACED_1, by: 'std' },
            panelMode: 'all',
          })
        )
      ).toBe('passivePrimary');
    });

    it('B.5 bis - all also applies to an occurrence with a path_and_schedule exception on tod, it should return passivePrimary', () => {
      expect(
        getCurveVisualState(
          buildInput({
            chart: 'tod',
            train: { id: PACED_1_OCC_2, exceptionType: 'path_and_schedule' },
            selection: { id: PACED_1, by: 'std' },
            panelMode: 'all',
          })
        )
      ).toBe('passivePrimary');
    });

    // Defensive cases for single mode (not produced by the current dispatch,
    // but locked in for future resilience).

    it('single mode with no prior occurrence selection on std, it should return passiveSecondary', () => {
      expect(
        getCurveVisualState(
          buildInput({
            chart: 'std',
            train: { id: PACED_1_OCC_2 },
            selection: { id: PACED_1, by: 'std' },
            panelMode: 'single',
          })
        )
      ).toBe('passiveSecondary');
    });

    it('single mode with a selection from another paced train, it should return none', () => {
      expect(
        getCurveVisualState(
          buildInput({
            chart: 'std',
            train: { id: PACED_1_OCC_2 },
            selection: { id: PACED_2_OCC_1, by: 'std' },
            panelMode: 'single',
          })
        )
      ).toBe('none');
    });
  });
});
