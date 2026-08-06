import { describe, it, expect } from 'vitest';

import type { CurveStyleInput } from '../../../types';
import getCurveVisualState from '../../getCurveVisualState';
import {
  buildInput,
  TRAIN_SCHEDULE_1,
  TRAIN_SCHEDULE_2,
  PACED_1_OCC_2,
  PACED_1_OCC_3,
} from './helpers';

describe('getCurveVisualState', () => {
  describe('D.* - rest / hover', () => {
    it.each(['std', 'tod'] as const)(
      'D.1 - no selection, no hover on %s, it should return none',
      (chart) => {
        expect(
          getCurveVisualState(
            buildInput({
              chart,
              train: { id: TRAIN_SCHEDULE_1 },
              selection: undefined,
            })
          )
        ).toEqual({ state: 'none', hovered: false });
      }
    );

    it.each(['std', 'tod'] as const)(
      'D.2 - hover on a unique train from train list on %s, it should return hover',
      (chart) => {
        expect(
          getCurveVisualState(
            buildInput({
              chart,
              train: { id: TRAIN_SCHEDULE_1 },
              hover: { trainId: TRAIN_SCHEDULE_1, from: 'timetable' },
            })
          )
        ).toEqual({ state: 'none', hovered: true });
      }
    );

    it.each(['std', 'tod'] as const)(
      'D.2 - other paced is not affected by the hover on %s, it should return none',
      (chart) => {
        expect(
          getCurveVisualState(
            buildInput({
              chart,
              train: { id: TRAIN_SCHEDULE_2 },
              hover: { trainId: TRAIN_SCHEDULE_1, from: 'timetable' },
            })
          )
        ).toEqual({ state: 'none', hovered: false });
      }
    );

    it.each(['std', 'tod'] as const)(
      'D.3 - hover on an occurrence from train list, sibling on %s should receive the hover',
      (chart) => {
        expect(
          getCurveVisualState(
            buildInput({
              chart,
              train: { id: PACED_1_OCC_3, relevantExceptionTypes: [] },
              hover: { trainId: PACED_1_OCC_2, from: 'timetable' },
            })
          )
        ).toEqual({ state: 'none', hovered: true });
      }
    );

    it.each(['std', 'tod'] as const)(
      'D.4 - hover from std on no-exception train, sibling without start_time exception on %s should receive the hover',
      (chart) => {
        expect(
          getCurveVisualState(
            buildInput({
              chart,
              train: { id: PACED_1_OCC_3, relevantExceptionTypes: [] },
              hover: { trainId: PACED_1_OCC_2, from: 'std' },
            })
          )
        ).toEqual({ state: 'none', hovered: true });
      }
    );

    it.each(['std', 'tod'] as const)(
      'D.4 - hover from std on no-exception train propagates to siblings with start_time exception on %s',
      (chart) => {
        expect(
          getCurveVisualState(
            buildInput({
              chart,
              train: { id: PACED_1_OCC_3, relevantExceptionTypes: ['start_time'] },
              hover: { trainId: PACED_1_OCC_2, from: 'std' },
            })
          )
        ).toEqual({ state: 'none', hovered: true });
      }
    );

    it.each(['std', 'tod'] as const)(
      'D.5 - hover from std on a start_time exception on %s, it should return hover',
      (chart) => {
        expect(
          getCurveVisualState(
            buildInput({
              chart,
              train: { id: PACED_1_OCC_2, relevantExceptionTypes: ['start_time'] },
              hover: { trainId: PACED_1_OCC_2, from: 'std' },
            })
          )
        ).toEqual({ state: 'none', hovered: true });
      }
    );

    it.each(['std', 'tod'] as const)(
      'D.5 - hover from std on a start_time exception propagates to siblings on %s',
      (chart) => {
        expect(
          getCurveVisualState(
            buildInput({
              chart,
              train: { id: PACED_1_OCC_3, relevantExceptionTypes: [] },
              hover: { trainId: PACED_1_OCC_2, from: 'std' },
            })
          )
        ).toEqual({ state: 'none', hovered: true });
      }
    );

    it.each(['std', 'tod'] as const)(
      'D.6 - hover from tod on no-exception train, sibling without path_and_schedule exception on %s should receive the hover',
      (chart) => {
        expect(
          getCurveVisualState(
            buildInput({
              chart,
              train: { id: PACED_1_OCC_3, relevantExceptionTypes: [] },
              hover: { trainId: PACED_1_OCC_2, from: 'tod' },
            })
          )
        ).toEqual({ state: 'none', hovered: true });
      }
    );

    it.each(['std', 'tod'] as const)(
      'D.6 - hover from tod on no-exception train propagates to siblings with path_and_schedule exception on %s',
      (chart) => {
        expect(
          getCurveVisualState(
            buildInput({
              chart,
              train: { id: PACED_1_OCC_3, relevantExceptionTypes: ['path_and_schedule'] },
              hover: { trainId: PACED_1_OCC_2, from: 'tod' },
            })
          )
        ).toEqual({ state: 'none', hovered: true });
      }
    );

    it.each(['std', 'tod'] as const)(
      'D.7 - hover from tod on a path_and_schedule exception on %s, it should return hover',
      (chart) => {
        expect(
          getCurveVisualState(
            buildInput({
              chart,
              train: { id: PACED_1_OCC_2, relevantExceptionTypes: ['path_and_schedule'] },
              hover: { trainId: PACED_1_OCC_2, from: 'tod' },
            })
          )
        ).toEqual({ state: 'none', hovered: true });
      }
    );

    it.each(['std', 'tod'] as const)(
      'D.7 - hover from tod on a path_and_schedule exception propagates to siblings on %s',
      (chart) => {
        expect(
          getCurveVisualState(
            buildInput({
              chart,
              train: { id: PACED_1_OCC_3, relevantExceptionTypes: [] },
              hover: { trainId: PACED_1_OCC_2, from: 'tod' },
            })
          )
        ).toEqual({ state: 'none', hovered: true });
      }
    );

    it.each([
      { chart: 'std', by: 'std' },
      { chart: 'tod', by: 'tod' },
    ] as const)(
      'D.8 - hover on an already active curve on $chart, it should stay active with hovered true',
      ({ chart, by }) => {
        expect(
          getCurveVisualState(
            buildInput({
              chart,
              train: { id: PACED_1_OCC_2, relevantExceptionTypes: [] },
              selection: { id: PACED_1_OCC_2, by },
              hover: { trainId: PACED_1_OCC_2, from: by },
            })
          )
        ).toEqual({ state: 'active', hovered: true });
      }
    );
  });

  describe('selective hover on the active selection', () => {
    const compliantStdSelection = {
      selection: { id: TRAIN_SCHEDULE_1, by: 'std' },
      panelMode: 'compliant',
    } as const;

    it('should highlight the compliant occurrences', () => {
      expect(
        getCurveVisualState(
          buildInput({
            ...compliantStdSelection,
            train: { id: PACED_1_OCC_3, relevantExceptionTypes: [] },
            hover: { trainId: PACED_1_OCC_2, from: 'std' },
          })
        ).hovered
      ).toBe(true);
    });

    it('should not highlight the exceptions', () => {
      expect(
        getCurveVisualState(
          buildInput({
            ...compliantStdSelection,
            train: { id: PACED_1_OCC_3, relevantExceptionTypes: ['start_time'] },
            hover: { trainId: PACED_1_OCC_2, from: 'std' },
          })
        ).hovered
      ).toBe(false);
    });

    it('should highlight only the hovered exception', () => {
      const hover: CurveStyleInput['hover'] = {
        trainId: PACED_1_OCC_2,
        from: 'std',
        relevantExceptionTypes: ['start_time'],
      };
      expect(
        getCurveVisualState(
          buildInput({
            ...compliantStdSelection,
            train: { id: PACED_1_OCC_2, relevantExceptionTypes: ['start_time'] },
            hover,
          })
        ).hovered
      ).toBe(true);
      expect(
        getCurveVisualState(
          buildInput({
            ...compliantStdSelection,
            train: { id: PACED_1_OCC_3, relevantExceptionTypes: [] },
            hover,
          })
        ).hovered
      ).toBe(false);
    });

    it('should highlight every occurrence when the selection is on another train', () => {
      expect(
        getCurveVisualState(
          buildInput({
            selection: { id: TRAIN_SCHEDULE_2, by: 'std' },
            panelMode: 'compliant',
            train: { id: PACED_1_OCC_3, relevantExceptionTypes: ['start_time'] },
            hover: { trainId: PACED_1_OCC_2, from: 'std' },
          })
        ).hovered
      ).toBe(true);
    });

    it('should highlight every occurrence when hovering from the train list', () => {
      expect(
        getCurveVisualState(
          buildInput({
            ...compliantStdSelection,
            train: { id: PACED_1_OCC_3, relevantExceptionTypes: ['start_time'] },
            hover: { trainId: PACED_1_OCC_2, from: 'timetable' },
          })
        ).hovered
      ).toBe(true);
    });
  });
});
