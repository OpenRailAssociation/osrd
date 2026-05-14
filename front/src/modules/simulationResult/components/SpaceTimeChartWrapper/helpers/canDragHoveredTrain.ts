import type { TrainId } from 'reducers/osrdconf/types';
import { extractTrainScheduleIdFromTrainId, isOccurrenceId } from 'utils/trainId';

import type { IndividualTrainProjection } from '../../../types';
import type { PanelSelectionMode } from '../CurveSelectionSidePanel';

/**
 * Decide whether the hovered train may start being dragged, given the active panel selection
 * mode. The caller must already have checked that the selection is shown with blue ('std')
 * curves — this only resolves the per-mode rule.
 *
 * Kept pure (no store / DOM access) so it can be unit-tested in isolation.
 */
export default function canDragHoveredTrain({
  panelSelectionMode,
  hoveredTrain,
  selectedTrainId,
}: {
  panelSelectionMode: PanelSelectionMode;
  hoveredTrain: IndividualTrainProjection;
  selectedTrainId?: TrainId;
}): boolean {
  const hoveredTrainId = hoveredTrain.id;
  if (!selectedTrainId) return false;

  const belongsToSelectedTrain =
    extractTrainScheduleIdFromTrainId(hoveredTrainId) ===
    extractTrainScheduleIdFromTrainId(selectedTrainId);

  switch (panelSelectionMode) {
    case 'compliant':
      // The hovered curve must belong to the selected train, and only a conforming occurrence
      // (no start_time exception) — or the non-paced train itself — is draggable: dragging it
      // shifts the model departure.
      return (
        belongsToSelectedTrain &&
        !('exception' in hoveredTrain && hoveredTrain.exception?.start_time)
      );

    case 'single':
      // only the selected occurrence (including start_time exceptions)
      return hoveredTrainId === selectedTrainId;

    case 'all':
      // any occurrence of the selected paced train (conforming or exception)
      return isOccurrenceId(hoveredTrainId) && belongsToSelectedTrain;

    default:
      return false;
  }
}
