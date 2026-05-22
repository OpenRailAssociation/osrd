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

  describe('B.* - selection from std', () => {
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

  describe('C.* - selection from tod', () => {
    // C.6 is covered by the C.3 tests: the helper sees the same inputs in both cases.
    // C.7 does not exist in the matrix.

    it('C.1 - unique train, train is the selected one on tod, it should return active', () => {
      expect(
        getCurveVisualState(
          buildInput({
            chart: 'tod',
            train: { id: PACED_1 },
            selection: { id: PACED_1, by: 'tod' },
          })
        )
      ).toBe('active');
    });

    it('C.1 bis - unique train, train is the selected one on std, it should return passivePrimary', () => {
      expect(
        getCurveVisualState(
          buildInput({
            chart: 'std',
            train: { id: PACED_1 },
            selection: { id: PACED_1, by: 'tod' },
          })
        )
      ).toBe('passivePrimary');
    });

    it('C.2 - compliant, train without path_and_schedule exception on tod, it should return active', () => {
      expect(
        getCurveVisualState(
          buildInput({
            chart: 'tod',
            train: { id: PACED_1_OCC_2 },
            selection: { id: PACED_1, by: 'tod' },
            panelMode: 'compliant',
          })
        )
      ).toBe('active');
    });

    it('C.2 bis - compliant, train without path_and_schedule exception on std, it should return passivePrimary', () => {
      expect(
        getCurveVisualState(
          buildInput({
            chart: 'std',
            train: { id: PACED_1_OCC_2 },
            selection: { id: PACED_1, by: 'tod' },
            panelMode: 'compliant',
          })
        )
      ).toBe('passivePrimary');
    });

    it('C.2 ter - compliant, train with path_and_schedule exception on tod, it should return passiveSecondary', () => {
      expect(
        getCurveVisualState(
          buildInput({
            chart: 'tod',
            train: { id: PACED_1_OCC_2, exceptionType: 'path_and_schedule' },
            selection: { id: PACED_1, by: 'tod' },
            panelMode: 'compliant',
          })
        )
      ).toBe('passiveSecondary');
    });

    it('C.2 quater - compliant, train with path_and_schedule exception on std, it should return none', () => {
      expect(
        getCurveVisualState(
          buildInput({
            chart: 'std',
            train: { id: PACED_1_OCC_2, exceptionType: 'path_and_schedule' },
            selection: { id: PACED_1, by: 'tod' },
            panelMode: 'compliant',
          })
        )
      ).toBe('none');
    });

    it('C.3 - single, last clicked occurrence on tod, it should return active', () => {
      expect(
        getCurveVisualState(
          buildInput({
            chart: 'tod',
            train: { id: PACED_1_OCC_2 },
            selection: { id: PACED_1_OCC_2, by: 'tod' },
            panelMode: 'single',
          })
        )
      ).toBe('active');
    });

    it('C.3 bis - single, last clicked occurrence on std, it should return passivePrimary', () => {
      expect(
        getCurveVisualState(
          buildInput({
            chart: 'std',
            train: { id: PACED_1_OCC_2 },
            selection: { id: PACED_1_OCC_2, by: 'tod' },
            panelMode: 'single',
          })
        )
      ).toBe('passivePrimary');
    });

    it('C.3 ter - single, other occurrence of same paced on tod, it should return passiveSecondary', () => {
      expect(
        getCurveVisualState(
          buildInput({
            chart: 'tod',
            train: { id: PACED_1_OCC_3 },
            selection: { id: PACED_1_OCC_2, by: 'tod' },
            panelMode: 'single',
          })
        )
      ).toBe('passiveSecondary');
    });

    it('C.3 quater - single, other occurrence of same paced on std, it should return none', () => {
      expect(
        getCurveVisualState(
          buildInput({
            chart: 'std',
            train: { id: PACED_1_OCC_3 },
            selection: { id: PACED_1_OCC_2, by: 'tod' },
            panelMode: 'single',
          })
        )
      ).toBe('none');
    });

    it('C.4 - single, self with path_and_schedule exception on tod, it should return active', () => {
      expect(
        getCurveVisualState(
          buildInput({
            chart: 'tod',
            train: { id: PACED_1_OCC_2, exceptionType: 'path_and_schedule' },
            selection: { id: PACED_1_OCC_2, by: 'tod' },
            panelMode: 'single',
          })
        )
      ).toBe('active');
    });

    it('C.4 bis - single, self with path_and_schedule exception on std, it should return passivePrimary', () => {
      expect(
        getCurveVisualState(
          buildInput({
            chart: 'std',
            train: { id: PACED_1_OCC_2, exceptionType: 'path_and_schedule' },
            selection: { id: PACED_1_OCC_2, by: 'tod' },
            panelMode: 'single',
          })
        )
      ).toBe('passivePrimary');
    });

    it('C.4 ter - single, other occurrence of same paced on tod, it should return passiveSecondary', () => {
      expect(
        getCurveVisualState(
          buildInput({
            chart: 'tod',
            train: { id: PACED_1_OCC_3 },
            selection: { id: PACED_1_OCC_2, by: 'tod' },
            panelMode: 'single',
          })
        )
      ).toBe('passiveSecondary');
    });

    it('C.4 quater - single, other occurrence of same paced on std, it should return none', () => {
      expect(
        getCurveVisualState(
          buildInput({
            chart: 'std',
            train: { id: PACED_1_OCC_3 },
            selection: { id: PACED_1_OCC_2, by: 'tod' },
            panelMode: 'single',
          })
        )
      ).toBe('none');
    });

    it('C.5 - all, any occurrence of same paced on tod, it should return active', () => {
      expect(
        getCurveVisualState(
          buildInput({
            chart: 'tod',
            train: { id: PACED_1_OCC_2 },
            selection: { id: PACED_1, by: 'tod' },
            panelMode: 'all',
          })
        )
      ).toBe('active');
    });

    it('C.5 bis - all, any occurrence of same paced on std, it should return passivePrimary', () => {
      expect(
        getCurveVisualState(
          buildInput({
            chart: 'std',
            train: { id: PACED_1_OCC_2 },
            selection: { id: PACED_1, by: 'tod' },
            panelMode: 'all',
          })
        )
      ).toBe('passivePrimary');
    });
  });

  describe('D.* - rest / hover', () => {
    it.each(['std', 'tod'] as const)('D.1 - no selection, no hover on %s, it should return none', (chart) => {
      expect(
        getCurveVisualState(
          buildInput({
            chart,
            train: { id: PACED_1 },
            selection: undefined,
          })
        )
      ).toBe('none');
    });

    it.each(['std', 'tod'] as const)(
      'D.2 - hover on a unique train from train list on %s, it should return hover (self only)',
      (chart) => {
        expect(
          getCurveVisualState(
            buildInput({
              chart,
              train: { id: PACED_1 },
              hover: { trainId: PACED_1, from: 'timetable' },
            })
          )
        ).toBe('hover');
      }
    );

    it.each(['std', 'tod'] as const)(
      'D.2 - other paced is not affected by the hover on %s, it should return none',
      (chart) => {
        expect(
          getCurveVisualState(
            buildInput({
              chart,
              train: { id: PACED_2 },
              hover: { trainId: PACED_1, from: 'timetable' },
            })
          )
        ).toBe('none');
      }
    );

    it.each(['std', 'tod'] as const)(
      'D.3 - hover on an occurrence from train list propagates to siblings on %s, it should return hover',
      (chart) => {
        expect(
          getCurveVisualState(
            buildInput({
              chart,
              train: { id: PACED_1_OCC_3 },
              hover: { trainId: PACED_1_OCC_2, from: 'timetable' },
            })
          )
        ).toBe('hover');
      }
    );

    it.each(['std', 'tod'] as const)(
      'D.4 - hover from std on no-exception train propagates to siblings without start_time exception on %s, it should return hover',
      (chart) => {
        expect(
          getCurveVisualState(
            buildInput({
              chart,
              train: { id: PACED_1_OCC_3 },
              hover: { trainId: PACED_1_OCC_2, from: 'std' },
            })
          )
        ).toBe('hover');
      }
    );

    it.each(['std', 'tod'] as const)(
      'D.4 - hover from std on no-exception train does not propagate to siblings with start_time exception on %s, it should return none',
      (chart) => {
        expect(
          getCurveVisualState(
            buildInput({
              chart,
              train: { id: PACED_1_OCC_3, exceptionType: 'start_time' },
              hover: { trainId: PACED_1_OCC_2, from: 'std' },
            })
          )
        ).toBe('none');
      }
    );

    it.each(['std', 'tod'] as const)(
      'D.5 - hover from std on a start_time exception on %s, it should return hover (self only)',
      (chart) => {
        expect(
          getCurveVisualState(
            buildInput({
              chart,
              train: { id: PACED_1_OCC_2, exceptionType: 'start_time' },
              hover: {
                trainId: PACED_1_OCC_2,
                from: 'std',
                exceptionType: 'start_time',
              },
            })
          )
        ).toBe('hover');
      }
    );

    it.each(['std', 'tod'] as const)(
      'D.5 - hover from std on a start_time exception does not propagate to siblings on %s, it should return none',
      (chart) => {
        expect(
          getCurveVisualState(
            buildInput({
              chart,
              train: { id: PACED_1_OCC_3 },
              hover: {
                trainId: PACED_1_OCC_2,
                from: 'std',
                exceptionType: 'start_time',
              },
            })
          )
        ).toBe('none');
      }
    );

    it.each(['std', 'tod'] as const)(
      'D.6 - hover from tod on no-exception train propagates to siblings without path_and_schedule exception on %s, it should return hover',
      (chart) => {
        expect(
          getCurveVisualState(
            buildInput({
              chart,
              train: { id: PACED_1_OCC_3 },
              hover: { trainId: PACED_1_OCC_2, from: 'tod' },
            })
          )
        ).toBe('hover');
      }
    );

    it.each(['std', 'tod'] as const)(
      'D.6 - hover from tod on no-exception train does not propagate to siblings with path_and_schedule exception on %s, it should return none',
      (chart) => {
        expect(
          getCurveVisualState(
            buildInput({
              chart,
              train: { id: PACED_1_OCC_3, exceptionType: 'path_and_schedule' },
              hover: { trainId: PACED_1_OCC_2, from: 'tod' },
            })
          )
        ).toBe('none');
      }
    );

    it.each(['std', 'tod'] as const)(
      'D.7 - hover from tod on a path_and_schedule exception on %s, it should return hover (self only)',
      (chart) => {
        expect(
          getCurveVisualState(
            buildInput({
              chart,
              train: { id: PACED_1_OCC_2, exceptionType: 'path_and_schedule' },
              hover: {
                trainId: PACED_1_OCC_2,
                from: 'tod',
                exceptionType: 'path_and_schedule',
              },
            })
          )
        ).toBe('hover');
      }
    );

    it.each(['std', 'tod'] as const)(
      'D.7 - hover from tod on a path_and_schedule exception does not propagate to siblings on %s, it should return none',
      (chart) => {
        expect(
          getCurveVisualState(
            buildInput({
              chart,
              train: { id: PACED_1_OCC_3 },
              hover: {
                trainId: PACED_1_OCC_2,
                from: 'tod',
                exceptionType: 'path_and_schedule',
              },
            })
          )
        ).toBe('none');
      }
    );

    it.each([
      { chart: 'std', by: 'std' },
      { chart: 'tod', by: 'tod' },
    ] as const)(
      'D.8 - hover on an already active curve on $chart, it should stay active',
      ({ chart, by }) => {
        expect(
          getCurveVisualState(
            buildInput({
              chart,
              train: { id: PACED_1_OCC_2 },
              selection: { id: PACED_1_OCC_2, by },
              hover: { trainId: PACED_1_OCC_2, from: by },
            })
          )
        ).toBe('active');
      }
    );
  });
});
