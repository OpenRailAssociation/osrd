/**
 * Classifies the visual state of a curve in the STD/TOD charts.
 *
 * Inline references like (A.1), (B.2 ter), etc. point to the rows of the
 * acceptance criteria matrix in issue #16585:
 * https://github.com/OpenRailAssociation/osrd/issues/16585
 */
import type {
  CurveStyleExceptionType,
  CurveStyleInput,
  CurveVisualClassification,
  CurveVisualState,
} from 'modules/simulationResult/types';
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

const getChartSelectionState = (
  chart: CurveStyleInput['chart'],
  train: TrainInput,
  selection: SelectedTrain,
  panelMode: CurveStyleInput['panelMode']
): CurveVisualState => {
  // The chart where the selection was made (= the "primary" chart for this state).
  const primaryChart = selection.by;

  // Self gets active on its own chart, passivePrimary on the other one
  // (B.1, B.1 bis, B.4, B.4 bis, and B.3 / B.6 last clicked, plus C mirrors).
  if (train.id === selection.id) return chart === primaryChart ? 'active' : 'passivePrimary';

  if (!samePacedTrain(train.id, selection.id)) return 'none';

  // 'all' (B.5, C.5): every occurrence of the selected paced gets the same as self.
  if (panelMode === 'all') return chart === primaryChart ? 'active' : 'passivePrimary';

  // 'single' (B.3/B.4/B.6 ter/quater, C mirrors): sibling occurrences get
  // passiveSecondary on the primary chart and none on the other one.
  if (panelMode === 'single') return chart === primaryChart ? 'passiveSecondary' : 'none';

  // 'compliant' (B.2, C.2): occurrences with the relevant exception get
  // passiveSecondary on both charts (they stay visible as family context on
  // the mirror, per the design planches), the rest gets the same as self.
  if (panelMode === 'compliant') {
    // The exception type relevant for this mode, derived from the selection source.
    const relevantException: CurveStyleExceptionType =
      selection.by === 'std' ? 'start_time' : 'path_and_schedule';
    if (train.exceptionType === relevantException) return 'passiveSecondary';
    return chart === primaryChart ? 'active' : 'passivePrimary';
  }

  return 'none';
};

const getCurveVisualState = ({
  chart,
  train,
  selection,
  panelMode,
  hover,
}: CurveStyleInput): CurveVisualClassification => {
  // E.4: a dragged train always gets 'drag', regardless of selection or hover.
  if (train.isDragging) return { state: 'drag', hovered: false };

  let state: CurveVisualState = 'none';
  if (selection) {
    state =
      selection.by === 'timetable'
        ? getTimetableSelectionState(train, selection)
        : getChartSelectionState(chart, train, selection, panelMode);
  }

  // The hover effect is only applied to the train directly under the cursor.
  // The matrix used to propagate it to paced siblings (D.3/D.4/D.6), but the
  // design planches show that only the directly hovered train changes visually.
  const hovered = !!hover && train.id === hover.trainId;

  return { state, hovered };
};

export default getCurveVisualState;
