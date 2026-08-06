import { describe, it, expect } from 'vitest';

import getCurveVisualState from '../../getCurveVisualState';
import {
  buildInput,
  TRAIN_SCHEDULE_1,
  PACED_1_OCC_2,
  PACED_1_OCC_3,
  PACED_2_OCC_1,
} from './helpers';

describe('getCurveVisualState', () => {
  describe('B.* - selection from std', () => {
    // B.6 is covered by the B.3 tests: the helper sees the same inputs in both cases.
    // B.7 is not tested here: the dispatch resets `by` to 'timetable', so the helper
    // falls back to the A.* rules.

    it('B.1 - unique train, train is the selected one on std, it should return active', () => {
      expect(
        getCurveVisualState(
          buildInput({
            chart: 'std',
            train: { id: TRAIN_SCHEDULE_1 },
            selection: { id: TRAIN_SCHEDULE_1, by: 'std' },
          })
        )
      ).toEqual({ state: 'active', hovered: false });
    });

    it('B.1 bis - unique train, train is the selected one on tod, it should return passivePrimary', () => {
      expect(
        getCurveVisualState(
          buildInput({
            chart: 'tod',
            train: { id: TRAIN_SCHEDULE_1 },
            selection: { id: TRAIN_SCHEDULE_1, by: 'std' },
          })
        )
      ).toEqual({ state: 'passivePrimary', hovered: false });
    });

    it('B.2 - compliant, train without start_time exception on std, it should return active', () => {
      expect(
        getCurveVisualState(
          buildInput({
            chart: 'std',
            train: { id: PACED_1_OCC_2, relevantExceptionTypes: [] },
            selection: { id: TRAIN_SCHEDULE_1, by: 'std' },
            panelMode: 'compliant',
          })
        )
      ).toEqual({ state: 'active', hovered: false });
    });

    it('B.2 bis - compliant, train without start_time exception on tod, it should return passivePrimary', () => {
      expect(
        getCurveVisualState(
          buildInput({
            chart: 'tod',
            train: { id: PACED_1_OCC_2, relevantExceptionTypes: [] },
            selection: { id: TRAIN_SCHEDULE_1, by: 'std' },
            panelMode: 'compliant',
          })
        )
      ).toEqual({ state: 'passivePrimary', hovered: false });
    });

    it('B.2 ter - compliant, train with start_time exception on std, it should return passiveSecondary', () => {
      expect(
        getCurveVisualState(
          buildInput({
            chart: 'std',
            train: { id: PACED_1_OCC_2, relevantExceptionTypes: ['start_time'] },
            selection: { id: TRAIN_SCHEDULE_1, by: 'std' },
            panelMode: 'compliant',
          })
        )
      ).toEqual({ state: 'passiveSecondary', hovered: false });
    });

    it('B.2 quater - compliant, train with start_time exception on tod, it should return none', () => {
      expect(
        getCurveVisualState(
          buildInput({
            chart: 'tod',
            train: { id: PACED_1_OCC_2, relevantExceptionTypes: ['start_time'] },
            selection: { id: TRAIN_SCHEDULE_1, by: 'std' },
            panelMode: 'compliant',
          })
        )
      ).toEqual({ state: 'none', hovered: false });
    });

    it('B.3 - single, last clicked occurrence on std, it should return active', () => {
      expect(
        getCurveVisualState(
          buildInput({
            chart: 'std',
            train: { id: PACED_1_OCC_2, relevantExceptionTypes: [] },
            selection: { id: PACED_1_OCC_2, by: 'std' },
            panelMode: 'single',
          })
        )
      ).toEqual({ state: 'active', hovered: false });
    });

    it('B.3 bis - single, last clicked occurrence on tod, it should return passivePrimary', () => {
      expect(
        getCurveVisualState(
          buildInput({
            chart: 'tod',
            train: { id: PACED_1_OCC_2, relevantExceptionTypes: [] },
            selection: { id: PACED_1_OCC_2, by: 'std' },
            panelMode: 'single',
          })
        )
      ).toEqual({ state: 'passivePrimary', hovered: false });
    });

    it('B.3 ter - single, other occurrence of same paced on std, it should return passiveSecondary', () => {
      expect(
        getCurveVisualState(
          buildInput({
            chart: 'std',
            train: { id: PACED_1_OCC_3, relevantExceptionTypes: [] },
            selection: { id: PACED_1_OCC_2, by: 'std' },
            panelMode: 'single',
          })
        )
      ).toEqual({ state: 'passiveSecondary', hovered: false });
    });

    it('B.3 quater - single, other occurrence of same paced on tod, it should return none', () => {
      expect(
        getCurveVisualState(
          buildInput({
            chart: 'tod',
            train: { id: PACED_1_OCC_3, relevantExceptionTypes: [] },
            selection: { id: PACED_1_OCC_2, by: 'std' },
            panelMode: 'single',
          })
        )
      ).toEqual({ state: 'none', hovered: false });
    });

    it('B.4 - single, self with start_time exception on std, it should return active', () => {
      expect(
        getCurveVisualState(
          buildInput({
            chart: 'std',
            train: { id: PACED_1_OCC_2, relevantExceptionTypes: ['start_time'] },
            selection: { id: PACED_1_OCC_2, by: 'std' },
            panelMode: 'single',
          })
        )
      ).toEqual({ state: 'active', hovered: false });
    });

    it('B.4 bis - single, self with start_time exception on tod, it should return passivePrimary', () => {
      expect(
        getCurveVisualState(
          buildInput({
            chart: 'tod',
            train: { id: PACED_1_OCC_2, relevantExceptionTypes: ['start_time'] },
            selection: { id: PACED_1_OCC_2, by: 'std' },
            panelMode: 'single',
          })
        )
      ).toEqual({ state: 'passivePrimary', hovered: false });
    });

    it('B.4 ter - single, other occurrence of same paced on std, it should return passiveSecondary', () => {
      expect(
        getCurveVisualState(
          buildInput({
            chart: 'std',
            train: { id: PACED_1_OCC_3, relevantExceptionTypes: [] },
            selection: { id: PACED_1_OCC_2, by: 'std' },
            panelMode: 'single',
          })
        )
      ).toEqual({ state: 'passiveSecondary', hovered: false });
    });

    it('B.4 quater - single, other occurrence of same paced on tod, it should return none', () => {
      expect(
        getCurveVisualState(
          buildInput({
            chart: 'tod',
            train: { id: PACED_1_OCC_3, relevantExceptionTypes: [] },
            selection: { id: PACED_1_OCC_2, by: 'std' },
            panelMode: 'single',
          })
        )
      ).toEqual({ state: 'none', hovered: false });
    });

    it('B.5 - all, any occurrence of same paced on std, it should return active', () => {
      expect(
        getCurveVisualState(
          buildInput({
            chart: 'std',
            train: { id: PACED_1_OCC_2, relevantExceptionTypes: [] },
            selection: { id: TRAIN_SCHEDULE_1, by: 'std' },
            panelMode: 'all',
          })
        )
      ).toEqual({ state: 'active', hovered: false });
    });

    it('B.5 - all also applies to an occurrence with a start_time exception on std, it should return active', () => {
      expect(
        getCurveVisualState(
          buildInput({
            chart: 'std',
            train: { id: PACED_1_OCC_2, relevantExceptionTypes: ['start_time'] },
            selection: { id: TRAIN_SCHEDULE_1, by: 'std' },
            panelMode: 'all',
          })
        )
      ).toEqual({ state: 'active', hovered: false });
    });

    it('B.5 bis - all, any occurrence of same paced on tod, it should return passivePrimary', () => {
      expect(
        getCurveVisualState(
          buildInput({
            chart: 'tod',
            train: { id: PACED_1_OCC_2, relevantExceptionTypes: [] },
            selection: { id: TRAIN_SCHEDULE_1, by: 'std' },
            panelMode: 'all',
          })
        )
      ).toEqual({ state: 'passivePrimary', hovered: false });
    });

    it('B.5 bis - all also applies to an occurrence with a path_and_schedule exception on tod, it should return passivePrimary', () => {
      expect(
        getCurveVisualState(
          buildInput({
            chart: 'tod',
            train: { id: PACED_1_OCC_2, relevantExceptionTypes: ['path_and_schedule'] },
            selection: { id: TRAIN_SCHEDULE_1, by: 'std' },
            panelMode: 'all',
          })
        )
      ).toEqual({ state: 'passivePrimary', hovered: false });
    });

    // Defensive cases for single mode (not produced by the current dispatch,
    // but locked in for future resilience).

    it('single mode with no prior occurrence selection on std, it should return passiveSecondary', () => {
      expect(
        getCurveVisualState(
          buildInput({
            chart: 'std',
            train: { id: PACED_1_OCC_2, relevantExceptionTypes: [] },
            selection: { id: TRAIN_SCHEDULE_1, by: 'std' },
            panelMode: 'single',
          })
        )
      ).toEqual({ state: 'passiveSecondary', hovered: false });
    });

    it('single mode with a selection from another paced train, it should return none', () => {
      expect(
        getCurveVisualState(
          buildInput({
            chart: 'std',
            train: { id: PACED_1_OCC_2, relevantExceptionTypes: [] },
            selection: { id: PACED_2_OCC_1, by: 'std' },
            panelMode: 'single',
          })
        )
      ).toEqual({ state: 'none', hovered: false });
    });
  });
});
