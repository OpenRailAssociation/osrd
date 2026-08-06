import type { CategoryColors } from 'applications/operationalStudies/types';
import type { CurveStyleInput } from 'modules/simulationResult/types';

import getCurveStyle from './getCurveStyle';
import getCurveVisualState, { samePacedTrain } from './getCurveVisualState';

// TODO: Drop getPathStyle when TOD style is implemented, and rename this fucntion to getCurveStyle
const getPathStyleV2 = (
  input: CurveStyleInput,
  train: { colors: CategoryColors; isSimulated?: boolean }
) => {
  const { state, hovered } = getCurveVisualState(input);

  // When the selection comes from the timetable, the other trains stay visible
  // (the goal is to preserve the overall context). Chart-driven selections fade
  // the rest out to put the focus on the click target. Resting curves of the
  // selected paced train (e.g. its excluded exceptions on the mirror chart)
  // are spared: they stay fully visible as family context, per the mockups.
  const outOfSelection =
    state === 'none' &&
    !!input.selection &&
    input.selection.by !== 'timetable' &&
    !samePacedTrain(input.train.id, input.selection.id);
  // During a drag, only the dragged paced train's resting curves soften;
  // unrelated ones keep their out-of-selection fade.
  const outOfDrag =
    state === 'none' && !!input.dragging && samePacedTrain(input.train.id, input.dragging.trainId);
  // Only the curves embarked in the drag (those taking the drag style) hide
  // their stop indicators while they move.
  const hideStops = state === 'drag';
  return getCurveStyle(state, train, {
    hovered,
    outOfSelection,
    outOfDrag,
    hideStops,
    chart: input.chart,
  });
};

export default getPathStyleV2;
