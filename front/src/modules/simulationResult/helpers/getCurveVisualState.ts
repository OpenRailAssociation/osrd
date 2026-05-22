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
  // passiveSecondary on the primary chart and none on the other one, the rest
  // gets the same as self.
  if (panelMode === 'compliant') {
    // The exception type relevant for this mode, derived from the selection source.
    const relevantException: CurveStyleExceptionType =
      selection.by === 'std' ? 'start_time' : 'path_and_schedule';
    if (train.exceptionType === relevantException) {
      return chart === primaryChart ? 'passiveSecondary' : 'none';
    }
    return chart === primaryChart ? 'active' : 'passivePrimary';
  }

  return 'none';
};

/**
 * Returns the hover state for this train, or `undefined` when the hover
 * does not apply to this train. The caller function uses hover as a layer
 * on top of the selection state: `undefined` means "keep the selection
 * state", a returned state means "override it".
 */
const getHoverState = (
  train: TrainInput,
  hover: NonNullable<CurveStyleInput['hover']>
): CurveVisualState | undefined => {
  // Self always gets hover (D.2, D.5, D.7, plus the hovered itself in D.3/D.4/D.6).
  if (train.id === hover.trainId) return 'hover';

  // Trains outside the hovered's paced family never get hover.
  if (!samePacedTrain(train.id, hover.trainId)) return undefined;

  // Hover from the train list (D.2, D.3):
  // - hovered is a unique train (PacedTrainId): only self gets hover (D.2, handled above).
  // - hovered is an occurrence (OccurrenceId): every occurrence of the paced gets hover (D.3).
  if (hover.from === 'timetable') {
    return isOccurrenceId(hover.trainId) ? 'hover' : undefined;
  }

  // Hover from a chart (STD or TOD): the relevant exception type follows the source.
  const relevantException: CurveStyleExceptionType =
    hover.from === 'std' ? 'start_time' : 'path_and_schedule';

  // Hovered itself has the relevant exception (D.5, D.7): only self gets hover.
  if (hover.exceptionType === relevantException) return undefined;

  // Hovered has no relevant exception (D.4, D.6): propagate to paced siblings that
  // also have no relevant exception.
  return train.exceptionType === relevantException ? undefined : 'hover';
};

const getCurveVisualState = ({
  chart,
  train,
  selection,
  panelMode,
  hover,
}: CurveStyleInput): CurveVisualState => {
  // E.4: a dragged train always gets 'drag', regardless of selection or hover.
  if (train.isDragging) return 'drag';

  let state: CurveVisualState = 'none';
  if (selection) {
    state =
      selection.by === 'timetable'
        ? getTimetableSelectionState(train, selection)
        : getChartSelectionState(chart, train, selection, panelMode);
  }

  // D.8: an already active curve stays active even when hovered.
  if (hover && state !== 'active') {
    const hoverState = getHoverState(train, hover);
    if (hoverState) return hoverState;
  }

  return state;
};

export default getCurveVisualState;
