import { describe, it, expect } from 'vitest';

import type { PacedTrainException } from 'common/api/osrdEditoastApi';
import type {
  CurveStyleExceptionType,
  IndividualTrainProjection,
} from 'modules/simulationResult/types';
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
  it('should forbid dragging when no train is selected, whatever the mode', () => {
    for (const panelSelectionMode of ['compliant', 'single', 'all'] as const) {
      expect(
        canDragHoveredTrain({
          panelSelectionMode,
          hoveredTrain: train(OCC_1_0),
          relevantExceptionType: 'start_time',
        })
      ).toBe(false);
    }
  });

  // Same rules for both charts: only the relevant exception differs
  // (start_time for the STD, path_and_schedule for the TOD).
  describe.each<{ relevantExceptionType: CurveStyleExceptionType; label: string }>([
    { relevantExceptionType: 'start_time', label: 'STD (start_time)' },
    { relevantExceptionType: 'path_and_schedule', label: 'TOD (path_and_schedule)' },
  ])('for the $label', ({ relevantExceptionType }) => {
    const otherExceptionType: CurveStyleExceptionType =
      relevantExceptionType === 'start_time' ? 'path_and_schedule' : 'start_time';

    describe("'compliant' mode", () => {
      it('should allow dragging the selected non-paced train', () => {
        expect(
          canDragHoveredTrain({
            panelSelectionMode: 'compliant',
            hoveredTrain: train(TRAIN_SCHEDULE_1),
            selectedTrainId: TRAIN_SCHEDULE_1,
            relevantExceptionType,
          })
        ).toBe(true);
      });

      it('should forbid dragging a non-paced train that is not the selected one', () => {
        expect(
          canDragHoveredTrain({
            panelSelectionMode: 'compliant',
            hoveredTrain: train(TRAIN_SCHEDULE_2),
            selectedTrainId: TRAIN_SCHEDULE_1,
            relevantExceptionType,
          })
        ).toBe(false);
      });

      it('should allow dragging a conforming occurrence of the selected train', () => {
        expect(
          canDragHoveredTrain({
            panelSelectionMode: 'compliant',
            hoveredTrain: train(OCC_1_0),
            selectedTrainId: TRAIN_SCHEDULE_1,
            relevantExceptionType,
          })
        ).toBe(true);
      });

      it('should forbid dragging a conforming occurrence of another paced train', () => {
        expect(
          canDragHoveredTrain({
            panelSelectionMode: 'compliant',
            hoveredTrain: train(OCC_2_0),
            selectedTrainId: TRAIN_SCHEDULE_1,
            relevantExceptionType,
          })
        ).toBe(false);
      });

      it('should allow dragging an occurrence that does not have the relevant exception', () => {
        expect(
          canDragHoveredTrain({
            panelSelectionMode: 'compliant',
            hoveredTrain: train(OCC_1_0, { [otherExceptionType]: { value: 'foo' } as never }),
            selectedTrainId: TRAIN_SCHEDULE_1,
            relevantExceptionType,
          })
        ).toBe(true);
      });

      it('should forbid dragging an occurrence of the selected train with the relevant exception', () => {
        expect(
          canDragHoveredTrain({
            panelSelectionMode: 'compliant',
            hoveredTrain: train(OCC_1_0, { [relevantExceptionType]: { value: 'foo' } as never }),
            selectedTrainId: TRAIN_SCHEDULE_1,
            relevantExceptionType,
          })
        ).toBe(false);
      });
    });

    describe("'single' mode", () => {
      it('should allow dragging only the selected occurrence', () => {
        expect(
          canDragHoveredTrain({
            panelSelectionMode: 'single',
            hoveredTrain: train(OCC_1_0),
            selectedTrainId: OCC_1_0,
            relevantExceptionType,
          })
        ).toBe(true);
      });

      it('should forbid dragging a different occurrence of the same paced train', () => {
        expect(
          canDragHoveredTrain({
            panelSelectionMode: 'single',
            hoveredTrain: train(OCC_1_1),
            selectedTrainId: OCC_1_0,
            relevantExceptionType,
          })
        ).toBe(false);
      });
    });

    describe("'all' mode", () => {
      it('should allow dragging any occurrence of the selected paced train (selected as PacedTrainId)', () => {
        expect(
          canDragHoveredTrain({
            panelSelectionMode: 'all',
            hoveredTrain: train(OCC_1_1),
            selectedTrainId: TRAIN_SCHEDULE_1,
            relevantExceptionType,
          })
        ).toBe(true);
      });

      it('should allow dragging when the selection is an occurrence of the same paced train', () => {
        expect(
          canDragHoveredTrain({
            panelSelectionMode: 'all',
            hoveredTrain: train(OCC_1_1),
            selectedTrainId: OCC_1_0,
            relevantExceptionType,
          })
        ).toBe(true);
      });

      it('should forbid dragging an occurrence of another paced train', () => {
        expect(
          canDragHoveredTrain({
            panelSelectionMode: 'all',
            hoveredTrain: train(OCC_2_0),
            selectedTrainId: TRAIN_SCHEDULE_1,
            relevantExceptionType,
          })
        ).toBe(false);
      });

      it('should forbid dragging a non-occurrence hovered train', () => {
        expect(
          canDragHoveredTrain({
            panelSelectionMode: 'all',
            hoveredTrain: train(TRAIN_SCHEDULE_1),
            selectedTrainId: TRAIN_SCHEDULE_1,
            relevantExceptionType,
          })
        ).toBe(false);
      });
    });
  });
});
