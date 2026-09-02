import { describe, it, expect } from 'vitest';

import getCurveVisualState from '../../getCurveVisualState';
import { buildInput, TRAIN_SCHEDULE_1, PACED_1_OCC_2, PACED_1_OCC_3 } from './helpers';

describe('getCurveVisualState', () => {
  describe('C.* - selection from tod', () => {
    // C.6 is covered by the C.3 tests: the helper sees the same inputs in both cases.
    // C.7 does not exist in the matrix.

    it('C.1 - unique train, train is the selected one on tod, it should return active', () => {
      expect(
        getCurveVisualState(
          buildInput({
            chart: 'tod',
            train: { id: TRAIN_SCHEDULE_1 },
            selection: { id: TRAIN_SCHEDULE_1, by: 'tod' },
          })
        )
      ).toEqual({ state: 'active', hovered: false });
    });

    it('C.1 bis - unique train, train is the selected one on std, it should return passivePrimary', () => {
      expect(
        getCurveVisualState(
          buildInput({
            chart: 'std',
            train: { id: TRAIN_SCHEDULE_1 },
            selection: { id: TRAIN_SCHEDULE_1, by: 'tod' },
          })
        )
      ).toEqual({ state: 'passivePrimary', hovered: false });
    });

    it('C.2 - compliant, train without path_and_schedule exception on tod, it should return active', () => {
      expect(
        getCurveVisualState(
          buildInput({
            chart: 'tod',
            train: { id: PACED_1_OCC_2, relevantExceptionTypes: [] },
            selection: { id: TRAIN_SCHEDULE_1, by: 'tod' },
            panelMode: 'compliant',
          })
        )
      ).toEqual({ state: 'active', hovered: false });
    });

    it('C.2 bis - compliant, train without path_and_schedule exception on std, it should return passivePrimary', () => {
      expect(
        getCurveVisualState(
          buildInput({
            chart: 'std',
            train: { id: PACED_1_OCC_2, relevantExceptionTypes: [] },
            selection: { id: TRAIN_SCHEDULE_1, by: 'tod' },
            panelMode: 'compliant',
          })
        )
      ).toEqual({ state: 'passivePrimary', hovered: false });
    });

    it('C.2 ter - compliant, train with path_and_schedule exception on tod, it should return passiveSecondary', () => {
      expect(
        getCurveVisualState(
          buildInput({
            chart: 'tod',
            train: { id: PACED_1_OCC_2, relevantExceptionTypes: ['path_and_schedule'] },
            selection: { id: TRAIN_SCHEDULE_1, by: 'tod' },
            panelMode: 'compliant',
          })
        )
      ).toEqual({ state: 'passiveSecondary', hovered: false });
    });

    it('C.2 quater - compliant, train with path_and_schedule exception on std, it should return none', () => {
      expect(
        getCurveVisualState(
          buildInput({
            chart: 'std',
            train: { id: PACED_1_OCC_2, relevantExceptionTypes: ['path_and_schedule'] },
            selection: { id: TRAIN_SCHEDULE_1, by: 'tod' },
            panelMode: 'compliant',
          })
        )
      ).toEqual({ state: 'none', hovered: false });
    });

    it('C.3 - single, last clicked occurrence on tod, it should return active', () => {
      expect(
        getCurveVisualState(
          buildInput({
            chart: 'tod',
            train: { id: PACED_1_OCC_2, relevantExceptionTypes: [] },
            selection: { id: PACED_1_OCC_2, by: 'tod' },
            panelMode: 'single',
          })
        )
      ).toEqual({ state: 'active', hovered: false });
    });

    it('C.3 bis - single, last clicked occurrence on std, it should return passivePrimary', () => {
      expect(
        getCurveVisualState(
          buildInput({
            chart: 'std',
            train: { id: PACED_1_OCC_2, relevantExceptionTypes: [] },
            selection: { id: PACED_1_OCC_2, by: 'tod' },
            panelMode: 'single',
          })
        )
      ).toEqual({ state: 'passivePrimary', hovered: false });
    });

    it('C.3 ter - single, other occurrence of same paced on tod, it should return passiveSecondary', () => {
      expect(
        getCurveVisualState(
          buildInput({
            chart: 'tod',
            train: { id: PACED_1_OCC_3, relevantExceptionTypes: [] },
            selection: { id: PACED_1_OCC_2, by: 'tod' },
            panelMode: 'single',
          })
        )
      ).toEqual({ state: 'passiveSecondary', hovered: false });
    });

    it('C.3 quater - single, other occurrence of same paced on std, it should return none', () => {
      expect(
        getCurveVisualState(
          buildInput({
            chart: 'std',
            train: { id: PACED_1_OCC_3, relevantExceptionTypes: [] },
            selection: { id: PACED_1_OCC_2, by: 'tod' },
            panelMode: 'single',
          })
        )
      ).toEqual({ state: 'none', hovered: false });
    });

    it('C.4 - single, self with path_and_schedule exception on tod, it should return active', () => {
      expect(
        getCurveVisualState(
          buildInput({
            chart: 'tod',
            train: { id: PACED_1_OCC_2, relevantExceptionTypes: ['path_and_schedule'] },
            selection: { id: PACED_1_OCC_2, by: 'tod' },
            panelMode: 'single',
          })
        )
      ).toEqual({ state: 'active', hovered: false });
    });

    it('C.4 bis - single, self with path_and_schedule exception on std, it should return passivePrimary', () => {
      expect(
        getCurveVisualState(
          buildInput({
            chart: 'std',
            train: { id: PACED_1_OCC_2, relevantExceptionTypes: ['path_and_schedule'] },
            selection: { id: PACED_1_OCC_2, by: 'tod' },
            panelMode: 'single',
          })
        )
      ).toEqual({ state: 'passivePrimary', hovered: false });
    });

    it('C.4 ter - single, other occurrence of same paced on tod, it should return passiveSecondary', () => {
      expect(
        getCurveVisualState(
          buildInput({
            chart: 'tod',
            train: { id: PACED_1_OCC_3, relevantExceptionTypes: [] },
            selection: { id: PACED_1_OCC_2, by: 'tod' },
            panelMode: 'single',
          })
        )
      ).toEqual({ state: 'passiveSecondary', hovered: false });
    });

    it('C.4 quater - single, other occurrence of same paced on std, it should return none', () => {
      expect(
        getCurveVisualState(
          buildInput({
            chart: 'std',
            train: { id: PACED_1_OCC_3, relevantExceptionTypes: [] },
            selection: { id: PACED_1_OCC_2, by: 'tod' },
            panelMode: 'single',
          })
        )
      ).toEqual({ state: 'none', hovered: false });
    });

    it('C.5 - all, any occurrence of same paced on tod, it should return active', () => {
      expect(
        getCurveVisualState(
          buildInput({
            chart: 'tod',
            train: { id: PACED_1_OCC_2, relevantExceptionTypes: [] },
            selection: { id: TRAIN_SCHEDULE_1, by: 'tod' },
            panelMode: 'all',
          })
        )
      ).toEqual({ state: 'active', hovered: false });
    });

    it('C.5 bis - all, any occurrence of same paced on std, it should return passivePrimary', () => {
      expect(
        getCurveVisualState(
          buildInput({
            chart: 'std',
            train: { id: PACED_1_OCC_2, relevantExceptionTypes: [] },
            selection: { id: TRAIN_SCHEDULE_1, by: 'tod' },
            panelMode: 'all',
          })
        )
      ).toEqual({ state: 'passivePrimary', hovered: false });
    });
  });
});
