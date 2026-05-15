/**
 * Classifies the visual state of a curve in the STD/TOD charts.
 *
 * Inline references like (A.1), (B.2 ter), etc. point to the rows of the
 * acceptance criteria matrix in issue #16585:
 * https://github.com/OpenRailAssociation/osrd/issues/16585
 */
import type { CurveStyleInput, CurveVisualState } from 'modules/simulationResult/types';
import type { TrainId } from 'reducers/osrdconf/types';
import type { SelectedTrain } from 'reducers/simulationResults/types';
import { extractPacedTrainIdFromTrainId, isOccurrenceId } from 'utils/trainId';

type TrainInput = CurveStyleInput['train'];

const samePacedTrain = (a: TrainId, b: TrainId) =>
  extractPacedTrainIdFromTrainId(a) === extractPacedTrainIdFromTrainId(b);

const getTimetableSelectionState = (
  train: TrainInput,
  selection: SelectedTrain
): CurveVisualState => {
  if (train.id === selection.id) return 'passivePrimary';
  if (!samePacedTrain(train.id, selection.id)) return 'none';

  // Selection is an occurrence; its sibling occurrences are passiveSecondary (A.2 bis).
  if (isOccurrenceId(selection.id)) return 'passiveSecondary';

  // Selection is the paced train itself: its occurrences with a start_time exception
  // get passiveSecondary (A.3 bis), the rest gets passivePrimary (A.3).
  return train.exceptionType === 'start_time' ? 'passiveSecondary' : 'passivePrimary';
};

const getCurveVisualState = ({ train, selection }: CurveStyleInput): CurveVisualState => {
  if (!selection) return 'none';

  if (selection.by === 'timetable') return getTimetableSelectionState(train, selection);

  return 'none';
};

export default getCurveVisualState;
