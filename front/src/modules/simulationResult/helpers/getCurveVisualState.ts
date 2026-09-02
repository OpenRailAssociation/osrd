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
import { extractTrainScheduleIdFromTrainId, isOccurrenceId } from 'utils/trainId';

type TrainInput = CurveStyleInput['train'];

/** The relevant exception types the train carries (empty for a non-occurrence train). */
const relevantExceptionTypesOf = (train: TrainInput): CurveStyleExceptionType[] =>
  'relevantExceptionTypes' in train ? train.relevantExceptionTypes : [];

export const samePacedTrain = (a: TrainId, b: TrainId) =>
  extractTrainScheduleIdFromTrainId(a) === extractTrainScheduleIdFromTrainId(b);

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
  return relevantExceptionTypesOf(train).includes('start_time')
    ? 'passiveSecondary'
    : 'passivePrimary';
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
  // passiveSecondary on the primary chart and rest on the mirror (B.2/C.2
  // quater), the rest gets the same as self.
  if (panelMode === 'compliant') {
    // The exception type relevant for this mode, derived from the selection source.
    const relevantException: CurveStyleExceptionType =
      selection.by === 'std' ? 'start_time' : 'path_and_schedule';
    if (relevantExceptionTypesOf(train).includes(relevantException))
      return chart === primaryChart ? 'passiveSecondary' : 'none';
    return chart === primaryChart ? 'active' : 'passivePrimary';
  }

  return 'none';
};

/**
 * Tells whether hovering `hover.trainId` should highlight `train`. By default
 * the hover covers every occurrence of the same paced train (D.2/D.3). When a
 * chart selection is already open on that paced train, the hover instead
 * previews what a click would select: hovering a compliant occurrence
 * highlights the other compliant ones, and hovering an exception highlights
 * only itself.
 */
const isHighlightedByHover = (
  train: TrainInput,
  hover: NonNullable<CurveStyleInput['hover']>,
  selection: CurveStyleInput['selection']
): boolean => {
  if (!samePacedTrain(train.id, hover.trainId)) return false;

  const isPreview =
    !!selection &&
    selection.by !== 'timetable' &&
    hover.from !== 'timetable' &&
    samePacedTrain(hover.trainId, selection.id);
  if (!isPreview) return true;

  const relevantException: CurveStyleExceptionType =
    hover.from === 'std' ? 'start_time' : 'path_and_schedule';
  if (hover.relevantExceptionTypes?.includes(relevantException)) return train.id === hover.trainId;
  return !relevantExceptionTypesOf(train).includes(relevantException);
};

const getCurveVisualState = ({
  chart,
  train,
  selection,
  panelMode,
  hover,
  dragging,
}: CurveStyleInput): CurveVisualClassification => {
  // E.4: the dragged train always gets the drag style. Whether it propagates
  // to the other occurrences of the same paced train mirrors exactly what the
  // drag moves, which is driven by the panel mode:
  //   - 'single': the dragged occurrence moves alone, no propagation.
  //   - 'all': every occurrence of the paced train moves together.
  //   - 'compliant' (and the default paced-base drag): the model moves, so the
  //     occurrences without a start_time exception follow, while the ones
  //     pinned by a start_time exception stay put. Dragging a start_time
  //     exception itself moves it alone.
  // The drag state always wins over selection or hover.
  if (dragging) {
    if (train.id === dragging.trainId) return { state: 'drag', hovered: false };
    // 'single' moves the dragged occurrence alone: siblings keep their normal
    // selection state, so we let them fall through below.
    if (panelMode !== 'single' && samePacedTrain(train.id, dragging.trainId)) {
      if (panelMode === 'all') return { state: 'drag', hovered: false };
      if (
        !dragging.relevantExceptionTypes?.includes('start_time') &&
        !relevantExceptionTypesOf(train).includes('start_time')
      )
        return { state: 'drag', hovered: false };
    }
  }

  let state: CurveVisualState = 'none';
  if (selection) {
    state =
      selection.by === 'timetable'
        ? getTimetableSelectionState(train, selection)
        : getChartSelectionState(chart, train, selection, panelMode);
  }

  const hovered = !!hover && isHighlightedByHover(train, hover, selection);

  return { state, hovered };
};

export default getCurveVisualState;
