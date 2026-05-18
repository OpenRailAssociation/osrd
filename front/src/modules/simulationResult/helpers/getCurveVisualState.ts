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

const getStdSelectionState = (
  chart: CurveStyleInput['chart'],
  train: TrainInput,
  selection: SelectedTrain,
  panelMode: CurveStyleInput['panelMode']
): CurveVisualState => {
  // Self gets active on its own chart, passivePrimary on the other one
  // (B.1, B.1 bis, B.4, B.4 bis, and B.3 / B.6 last clicked).
  if (train.id === selection.id) return chart === 'std' ? 'active' : 'passivePrimary';

  if (!samePacedTrain(train.id, selection.id)) return 'none';

  // 'all' (B.5, B.5 bis): every occurrence of the selected paced gets the same as self.
  if (panelMode === 'all') return chart === 'std' ? 'active' : 'passivePrimary';

  // 'single' (B.3 ter/quater, B.4 ter/quater, B.6 ter/quater): sibling occurrences
  // get passiveSecondary on std and none on tod.
  if (panelMode === 'single') return chart === 'std' ? 'passiveSecondary' : 'none';

  // 'compliant' (B.2 *): occurrences with a start_time exception get passiveSecondary
  // on std and none on tod, the rest gets the same as self.
  if (panelMode === 'compliant') {
    if (train.exceptionType === 'start_time') {
      return chart === 'std' ? 'passiveSecondary' : 'none';
    }
    return chart === 'std' ? 'active' : 'passivePrimary';
  }

  return 'none';
};

const getCurveVisualState = ({
  chart,
  train,
  selection,
  panelMode,
}: CurveStyleInput): CurveVisualState => {
  if (!selection) return 'none';

  if (selection.by === 'timetable') return getTimetableSelectionState(train, selection);

  if (selection.by === 'std') return getStdSelectionState(chart, train, selection, panelMode);

  return 'none';
};

export default getCurveVisualState;
