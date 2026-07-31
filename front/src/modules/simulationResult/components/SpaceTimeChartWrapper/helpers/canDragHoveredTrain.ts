import type {
  CurveStyleExceptionType,
  IndividualTrainProjection,
} from 'modules/simulationResult/types';
import type { TrainId } from 'reducers/osrdconf/types';
import { extractTrainScheduleIdFromTrainId, isOccurrenceId } from 'utils/trainId';

import type { PanelSelectionMode } from '../CurveSelectionSidePanel';

/**
 * Decide whether the hovered train (a STD curve or a TOD occupancy zone) may start being
 * dragged, given the active panel selection mode. The caller must already have checked that
 * the selection is shown as active on that chart (`selectedTrainBy` matching) — this only
 * resolves the per-mode rule.
 *
 * `relevantExceptionType` is the exception that makes an occurrence non-compliant on the
 * caller's chart: `start_time` for the STD, `path_and_schedule` for the TOD.
 *
 * Kept pure (no store / DOM access) so it can be unit-tested in isolation.
 */
export default function canDragHoveredTrain({
  panelSelectionMode,
  hoveredTrain,
  selectedTrainId,
  relevantExceptionType,
}: {
  panelSelectionMode: PanelSelectionMode;
  hoveredTrain: IndividualTrainProjection;
  selectedTrainId?: TrainId;
  relevantExceptionType: CurveStyleExceptionType;
}): boolean {
  const hoveredTrainId = hoveredTrain.id;
  if (!selectedTrainId) return false;

  const belongsToSelectedTrain =
    extractTrainScheduleIdFromTrainId(hoveredTrainId) ===
    extractTrainScheduleIdFromTrainId(selectedTrainId);

  switch (panelSelectionMode) {
    case 'compliant':
      // The hovered curve must belong to the selected train, and only a conforming occurrence
      // (no relevant exception) — or the non-paced train itself — is draggable: dragging it
      // shifts the model departure.
      return (
        belongsToSelectedTrain &&
        !('exception' in hoveredTrain && hoveredTrain.exception?.[relevantExceptionType])
      );

    case 'single':
      // only the selected occurrence (including exceptions)
      return hoveredTrainId === selectedTrainId;

    case 'all':
      // any occurrence of the selected paced train (conforming or exception)
      return isOccurrenceId(hoveredTrainId) && belongsToSelectedTrain;

    default:
      return false;
  }
}
