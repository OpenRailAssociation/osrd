import { describe, it, expect } from 'vitest';

import getCurveVisualState from '../../getCurveVisualState';
import {
  buildInput,
  TRAIN_SCHEDULE_1,
  TRAIN_SCHEDULE_2,
  PACED_1_OCC_2,
  PACED_1_OCC_3,
} from './helpers';

describe('getCurveVisualState', () => {
  describe('E.* - transverse', () => {
    // E.1 (active selection makes other curves faded) belongs to getCurveStyle
    // since it is about the 'opacity' primitive, not the visual state.
    // E.2 and E.3 are rendering tasks (TOD dashed lines and occupation bars).

    it.each(['std', 'tod'] as const)(
      'E.4 - dragged train on %s, it should return drag',
      (chart) => {
        expect(
          getCurveVisualState(
            buildInput({
              chart,
              train: { id: TRAIN_SCHEDULE_1 },
              dragging: { trainId: TRAIN_SCHEDULE_1 },
            })
          )
        ).toEqual({ state: 'drag', hovered: false });
      }
    );

    it.each(['std', 'tod'] as const)(
      'E.4 - drag propagates to paced train siblings without exception on %s',
      (chart) => {
        expect(
          getCurveVisualState(
            buildInput({
              chart,
              train: { id: PACED_1_OCC_3, relevantExceptionTypes: [] },
              dragging: { trainId: PACED_1_OCC_2 },
            })
          )
        ).toEqual({ state: 'drag', hovered: false });
      }
    );

    it.each(['std', 'tod'] as const)(
      'E.4 - drag propagates to paced train siblings with path_and_schedule exception on %s',
      (chart) => {
        expect(
          getCurveVisualState(
            buildInput({
              chart,
              train: { id: PACED_1_OCC_3, relevantExceptionTypes: ['path_and_schedule'] },
              dragging: { trainId: PACED_1_OCC_2 },
            })
          )
        ).toEqual({ state: 'drag', hovered: false });
      }
    );

    it.each(['std', 'tod'] as const)(
      'E.4 - drag does not propagate to paced train siblings with start_time exception on %s',
      (chart) => {
        expect(
          getCurveVisualState(
            buildInput({
              chart,
              train: { id: PACED_1_OCC_3, relevantExceptionTypes: ['start_time'] },
              dragging: { trainId: PACED_1_OCC_2 },
            })
          )
        ).toEqual({ state: 'none', hovered: false });
      }
    );

    it.each(['std', 'tod'] as const)(
      'E.4 - dragged occurrence with a start_time exception on %s, it should return drag',
      (chart) => {
        expect(
          getCurveVisualState(
            buildInput({
              chart,
              train: { id: PACED_1_OCC_2, relevantExceptionTypes: ['start_time'] },
              dragging: { trainId: PACED_1_OCC_2, relevantExceptionTypes: ['start_time'] },
            })
          )
        ).toEqual({ state: 'drag', hovered: false });
      }
    );

    it.each(['std', 'tod'] as const)(
      'E.4 - drag of a start_time exception does not propagate to compliant siblings on %s',
      (chart) => {
        expect(
          getCurveVisualState(
            buildInput({
              chart,
              train: { id: PACED_1_OCC_3, relevantExceptionTypes: [] },
              dragging: { trainId: PACED_1_OCC_2, relevantExceptionTypes: ['start_time'] },
            })
          )
        ).toEqual({ state: 'none', hovered: false });
      }
    );

    it.each(['std', 'tod'] as const)(
      'E.4 - drag does not propagate to other paced trains on %s',
      (chart) => {
        expect(
          getCurveVisualState(
            buildInput({
              chart,
              train: { id: TRAIN_SCHEDULE_2 },
              dragging: { trainId: TRAIN_SCHEDULE_1 },
            })
          )
        ).toEqual({ state: 'none', hovered: false });
      }
    );

    it.each(['std', 'tod'] as const)(
      'E.4 - in single mode the dragged occurrence gets drag on %s',
      (chart) => {
        expect(
          getCurveVisualState(
            buildInput({
              chart,
              train: { id: PACED_1_OCC_2, relevantExceptionTypes: [] },
              panelMode: 'single',
              dragging: { trainId: PACED_1_OCC_2 },
            })
          )
        ).toEqual({ state: 'drag', hovered: false });
      }
    );

    it.each(['std', 'tod'] as const)(
      'E.4 - in single mode the drag does not propagate to compliant siblings on %s',
      (chart) => {
        expect(
          getCurveVisualState(
            buildInput({
              chart,
              train: { id: PACED_1_OCC_3, relevantExceptionTypes: [] },
              panelMode: 'single',
              dragging: { trainId: PACED_1_OCC_2 },
            })
          )
        ).toEqual({ state: 'none', hovered: false });
      }
    );

    it.each(['std', 'tod'] as const)(
      'E.4 - in all mode the drag propagates to every occurrence, including start_time ones, on %s',
      (chart) => {
        expect(
          getCurveVisualState(
            buildInput({
              chart,
              train: { id: PACED_1_OCC_3, relevantExceptionTypes: ['start_time'] },
              panelMode: 'all',
              dragging: { trainId: PACED_1_OCC_2 },
            })
          )
        ).toEqual({ state: 'drag', hovered: false });
      }
    );

    it('E.4 - drag should win over an active selection', () => {
      expect(
        getCurveVisualState(
          buildInput({
            chart: 'std',
            train: { id: TRAIN_SCHEDULE_1 },
            selection: { id: TRAIN_SCHEDULE_1, by: 'std' },
            dragging: { trainId: TRAIN_SCHEDULE_1 },
          })
        )
      ).toEqual({ state: 'drag', hovered: false });
    });

    it('E.4 - drag should win over a hover', () => {
      expect(
        getCurveVisualState(
          buildInput({
            chart: 'std',
            train: { id: TRAIN_SCHEDULE_1 },
            hover: { trainId: TRAIN_SCHEDULE_1, from: 'std' },
            dragging: { trainId: TRAIN_SCHEDULE_1 },
          })
        )
      ).toEqual({ state: 'drag', hovered: false });
    });
  });

  describe('cumulated exceptions', () => {
    it('should treat a train with both exception types as non compliant for a std selection', () => {
      expect(
        getCurveVisualState(
          buildInput({
            chart: 'std',
            train: {
              id: PACED_1_OCC_2,
              relevantExceptionTypes: ['start_time', 'path_and_schedule'],
            },
            selection: { id: TRAIN_SCHEDULE_1, by: 'std' },
            panelMode: 'compliant',
          })
        )
      ).toEqual({ state: 'passiveSecondary', hovered: false });
    });

    it('should treat a train with both exception types as non compliant for a tod selection', () => {
      expect(
        getCurveVisualState(
          buildInput({
            chart: 'tod',
            train: {
              id: PACED_1_OCC_2,
              relevantExceptionTypes: ['start_time', 'path_and_schedule'],
            },
            selection: { id: TRAIN_SCHEDULE_1, by: 'tod' },
            panelMode: 'compliant',
          })
        )
      ).toEqual({ state: 'passiveSecondary', hovered: false });
    });

    it('should keep a train with both exception types still during a paced-base drag', () => {
      expect(
        getCurveVisualState(
          buildInput({
            chart: 'std',
            train: {
              id: PACED_1_OCC_3,
              relevantExceptionTypes: ['start_time', 'path_and_schedule'],
            },
            dragging: { trainId: PACED_1_OCC_2 },
          })
        )
      ).toEqual({ state: 'none', hovered: false });
    });
  });
});
