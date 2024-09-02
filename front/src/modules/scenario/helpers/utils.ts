import { isInvalidName } from 'applications/operationalStudies/utils';
import type { TrainScheduleResult } from 'common/api/osrdEditoastApi';
import { SMALL_TEXT_AREA_MAX_LENGTH, isInvalidString } from 'utils/strings';

import type { ScenarioForm } from '../components/AddOrEditScenarioModal';

/**
 * Retrieves the datetime window of a scenario based on the provided train details.
 * @param trainsDetails - An array of TrainScheduleResult objects containing train details.
 * @returns An object representing the datetime window of the scenario, with `begin` and `end` properties.
 */
export const getScenarioDatetimeWindow = (trainsDetails: TrainScheduleResult[] = []) => {
  if (trainsDetails.length === 0) return undefined;
  const sortedDateList = trainsDetails
    .map((train) => new Date(train.start_time))
    .sort((a, b) => a.getTime() - b.getTime());

  return {
    begin: sortedDateList[0],
    end: sortedDateList[sortedDateList.length - 1],
  };
};

export const checkScenarioFields = (
  scenario: ScenarioForm
): {
  name: boolean;
  description: boolean;
} => ({
  name: isInvalidName(scenario.name),
  description: isInvalidString(SMALL_TEXT_AREA_MAX_LENGTH, scenario.description),
});
