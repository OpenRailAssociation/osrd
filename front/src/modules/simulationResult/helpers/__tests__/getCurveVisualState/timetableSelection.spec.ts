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
  describe('A.* - selection from train list', () => {
    it.each(['std', 'tod'] as const)(
      'A.1 - unique train, train is the selected one on %s, it should return passivePrimary',
      (chart) => {
        expect(
          getCurveVisualState(
            buildInput({
              chart,
              train: { id: TRAIN_SCHEDULE_1 },
              selection: { id: TRAIN_SCHEDULE_1, by: 'timetable' },
            })
          )
        ).toEqual({ state: 'passivePrimary', hovered: false });
      }
    );

    it.each(['std', 'tod'] as const)(
      'A.2 - occurrence selected, train is the target occurrence on %s, it should return passivePrimary',
      (chart) => {
        expect(
          getCurveVisualState(
            buildInput({
              chart,
              train: { id: PACED_1_OCC_2, relevantExceptionTypes: [] },
              selection: { id: PACED_1_OCC_2, by: 'timetable' },
            })
          )
        ).toEqual({ state: 'passivePrimary', hovered: false });
      }
    );

    it.each(['std', 'tod'] as const)(
      'A.2 bis - occurrence selected, train is another occurrence of same paced on %s, it should return passiveSecondary',
      (chart) => {
        expect(
          getCurveVisualState(
            buildInput({
              chart,
              train: { id: PACED_1_OCC_3, relevantExceptionTypes: [] },
              selection: { id: PACED_1_OCC_2, by: 'timetable' },
            })
          )
        ).toEqual({ state: 'passiveSecondary', hovered: false });
      }
    );

    it.each(['std', 'tod'] as const)(
      'A.3 - paced train selected, train has no start_time exception on %s, it should return passivePrimary',
      (chart) => {
        expect(
          getCurveVisualState(
            buildInput({
              chart,
              train: { id: PACED_1_OCC_2, relevantExceptionTypes: [] },
              selection: { id: TRAIN_SCHEDULE_1, by: 'timetable' },
            })
          )
        ).toEqual({ state: 'passivePrimary', hovered: false });
      }
    );

    it.each(['std', 'tod'] as const)(
      'A.3 bis - paced train selected, train has a start_time exception on %s, it should return passiveSecondary',
      (chart) => {
        expect(
          getCurveVisualState(
            buildInput({
              chart,
              train: { id: PACED_1_OCC_2, relevantExceptionTypes: ['start_time'] },
              selection: { id: TRAIN_SCHEDULE_1, by: 'timetable' },
            })
          )
        ).toEqual({ state: 'passiveSecondary', hovered: false });
      }
    );

    it.each(['std', 'tod'] as const)(
      'train unrelated to the selected paced on %s, it should return none',
      (chart) => {
        expect(
          getCurveVisualState(
            buildInput({
              chart,
              train: { id: TRAIN_SCHEDULE_2 },
              selection: { id: TRAIN_SCHEDULE_1, by: 'timetable' },
            })
          )
        ).toEqual({ state: 'none', hovered: false });
      }
    );
  });
});
