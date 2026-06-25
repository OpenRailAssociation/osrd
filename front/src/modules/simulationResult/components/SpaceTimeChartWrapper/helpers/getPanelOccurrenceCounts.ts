import { getOccurrencesNb } from 'modules/trainSchedule/helpers/pacedTrain';
import type { PacedDetails } from 'modules/trainSchedule/types';

import type { CurveStyleExceptionType } from '../../../types';

/**
 * For the curve selection panel:
 * - `all` = every active occurrence of the paced train
 * - `compliant` = occurrences that still match the paced pattern on the chart's
 *   relevant field (`start_time` for the STD, `path_and_schedule` for the TOD)
 */
const getPanelOccurrenceCounts = (
  paced: PacedDetails,
  exceptionType: CurveStyleExceptionType
): { compliant: number; all: number } => {
  let active = getOccurrencesNb({
    timeWindow: paced.timeWindow,
    interval: paced.interval,
  });
  let nonCompliant = 0;

  for (const exception of paced.exceptions) {
    // A disabled indexed exception hides that occurrence entirely.
    if (exception.occurrence_index !== undefined && exception.disabled) {
      active -= 1;
      continue;
    }
    // An added exception introduces a new active occurrence on top of the pattern.
    if (exception.occurrence_index === undefined) {
      active += 1;
    }
    // Any active exception that overrides the chart's relevant field is non-compliant.
    if (exception.change_groups[exceptionType]) nonCompliant += 1;
  }

  return { compliant: active - nonCompliant, all: active };
};

export default getPanelOccurrenceCounts;
