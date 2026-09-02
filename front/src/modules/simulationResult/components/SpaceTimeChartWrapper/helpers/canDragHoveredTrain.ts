import type {
  CurveStyleExceptionType,
  IndividualTrainProjection,
} from 'modules/simulationResult/types';
import type { TrainId } from 'reducers/osrdconf/types';
import type { SelectionSource } from 'reducers/simulationResults/types';

import type { PanelSelectionMode } from '../CurveSelectionSidePanel';
import { isTrainSelected } from './utils';

/**
 * Decide whether the hovered train (a STD curve or a TOD occupancy zone) may start being
 * dragged, given the active panel selection mode. Also checks that the selection is shown
 * as active on the caller's chart (`selectedTrainBy` matching).
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
  selectedTrainBy,
  relevantExceptionType,
}: {
  panelSelectionMode: PanelSelectionMode;
  hoveredTrain: IndividualTrainProjection;
  selectedTrainId?: TrainId;
  selectedTrainBy?: SelectionSource;
  relevantExceptionType: CurveStyleExceptionType;
}): boolean {
  if (!selectedTrainId || !selectedTrainBy) return false;

  const hasRelevantException =
    'exception' in hoveredTrain && hoveredTrain.exception?.[relevantExceptionType] !== undefined;
  const exceptionTypes: CurveStyleExceptionType[] = hasRelevantException
    ? [relevantExceptionType]
    : [];

  return isTrainSelected(
    hoveredTrain.id,
    relevantExceptionType === 'start_time' ? 'std' : 'tod',
    exceptionTypes,
    { id: selectedTrainId, by: selectedTrainBy },
    panelSelectionMode
  );
}
