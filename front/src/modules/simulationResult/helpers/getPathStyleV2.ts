import type { CategoryColors } from 'applications/operationalStudies/types';
import type { CurveStyleInput } from 'modules/simulationResult/types';

import getCurveStyle from './getCurveStyle';
import getCurveVisualState from './getCurveVisualState';

// TODO: Drop getPathStyle when TOD style is implemented, and rename this fucntion to getCurveStyle
const getPathStyleV2 = (
  input: CurveStyleInput,
  train: { colors: CategoryColors; isSimulated?: boolean }
) => {
  const { state, hovered } = getCurveVisualState(input);

  // When the selection comes from the timetable, the other trains stay visible
  // (the goal is to preserve the overall context). Chart-driven selections fade
  // the rest out to put the focus on the click target.
  const outOfSelection =
    state === 'none' && !!input.selection && input.selection.by !== 'timetable';
  return getCurveStyle(state, train, { hovered, outOfSelection, chart: input.chart });
};

export default getPathStyleV2;
