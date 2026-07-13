import { describe, it, expect } from 'vitest';

import type { PacedTrainException } from 'common/api/osrdEditoastApi';
import type { IndividualTrainProjection } from 'modules/simulationResult/types';
import type { OccurrenceId, TrainScheduleId, TrainId } from 'reducers/osrdconf/types';

import canDragHoveredTrain from '../canDragHoveredTrain';

const TRAIN_SCHEDULE_1 = 'trainSchedule_1' as TrainScheduleId;
const TRAIN_SCHEDULE_2 = 'trainSchedule_2' as TrainScheduleId;
const OCC_1_0 = 'indexedoccurrence_1_0' as OccurrenceId;
const OCC_1_1 = 'indexedoccurrence_1_1' as OccurrenceId;
const OCC_2_0 = 'indexedoccurrence_2_0' as OccurrenceId;

const train = (id: TrainId, exception?: Partial<PacedTrainException>): IndividualTrainProjection =>
  ({ id, ...(exception ? { exception } : {}) }) as IndividualTrainProjection;

describe('canDragHoveredTrain', () => {
  it('forbids dragging when no train is selected, whatever the mode', () => {
    for (const panelSelectionMode of ['compliant', 'single', 'all'] as const) {
      expect(canDragHoveredTrain({ panelSelectionMode, hoveredTrain: train(OCC_1_0) })).toBe(false);
    }
  });

  describe("'compliant' mode", () => {
    it('allows dragging the selected non-paced train', () => {
      expect(
        canDragHoveredTrain({
          panelSelectionMode: 'compliant',
          hoveredTrain: train(TRAIN_SCHEDULE_1),
          selectedTrainId: TRAIN_SCHEDULE_1,
        })
      ).toBe(true);
    });

    it('forbids dragging a non-paced train that is not the selected one', () => {
      expect(
        canDragHoveredTrain({
          panelSelectionMode: 'compliant',
          hoveredTrain: train(TRAIN_SCHEDULE_2),
          selectedTrainId: TRAIN_SCHEDULE_1,
        })
      ).toBe(false);
    });

    it('allows dragging a conforming occurrence of the selected train', () => {
      expect(
        canDragHoveredTrain({
          panelSelectionMode: 'compliant',
          hoveredTrain: train(OCC_1_0),
          selectedTrainId: TRAIN_SCHEDULE_1,
        })
      ).toBe(true);
    });

    it('forbids dragging a conforming occurrence of another paced train', () => {
      expect(
        canDragHoveredTrain({
          panelSelectionMode: 'compliant',
          hoveredTrain: train(OCC_2_0),
          selectedTrainId: TRAIN_SCHEDULE_1,
        })
      ).toBe(false);
    });

    it('allows dragging an occurrence whose exception does not override start_time', () => {
      expect(
        canDragHoveredTrain({
          panelSelectionMode: 'compliant',
          hoveredTrain: train(OCC_1_0, { path_and_schedule: { value: 'foo' } as never }),
          selectedTrainId: TRAIN_SCHEDULE_1,
        })
      ).toBe(true);
    });

    it('forbids dragging an occurrence of the selected train with a start_time exception', () => {
      expect(
        canDragHoveredTrain({
          panelSelectionMode: 'compliant',
          hoveredTrain: train(OCC_1_0, { start_time: { value: 1000 } }),
          selectedTrainId: TRAIN_SCHEDULE_1,
        })
      ).toBe(false);
    });
  });

  describe("'single' mode", () => {
    it('allows dragging only the selected occurrence', () => {
      expect(
        canDragHoveredTrain({
          panelSelectionMode: 'single',
          hoveredTrain: train(OCC_1_0),
          selectedTrainId: OCC_1_0,
        })
      ).toBe(true);
    });

    it('forbids dragging a different occurrence of the same paced train', () => {
      expect(
        canDragHoveredTrain({
          panelSelectionMode: 'single',
          hoveredTrain: train(OCC_1_1),
          selectedTrainId: OCC_1_0,
        })
      ).toBe(false);
    });
  });

  describe("'all' mode", () => {
    it('allows dragging any occurrence of the selected paced train (selected as PacedTrainId)', () => {
      expect(
        canDragHoveredTrain({
          panelSelectionMode: 'all',
          hoveredTrain: train(OCC_1_1),
          selectedTrainId: TRAIN_SCHEDULE_1,
        })
      ).toBe(true);
    });

    it('allows dragging when the selection is an occurrence of the same paced train', () => {
      expect(
        canDragHoveredTrain({
          panelSelectionMode: 'all',
          hoveredTrain: train(OCC_1_1),
          selectedTrainId: OCC_1_0,
        })
      ).toBe(true);
    });

    it('forbids dragging an occurrence of another paced train', () => {
      expect(
        canDragHoveredTrain({
          panelSelectionMode: 'all',
          hoveredTrain: train(OCC_2_0),
          selectedTrainId: TRAIN_SCHEDULE_1,
        })
      ).toBe(false);
    });

    it('forbids dragging a non-occurrence hovered train', () => {
      expect(
        canDragHoveredTrain({
          panelSelectionMode: 'all',
          hoveredTrain: train(TRAIN_SCHEDULE_1),
          selectedTrainId: TRAIN_SCHEDULE_1,
        })
      ).toBe(false);
    });
  });
});
