import { isInvalidName } from 'applications/operationalStudies/utils';
import { SMALL_TEXT_AREA_MAX_LENGTH, isInvalidString } from 'utils/strings';

import type { ScenarioForm } from './components/AddOrEditScenarioModal';

const checkScenarioFields = (
  scenario: ScenarioForm
): {
  name: boolean;
  description: boolean;
} => ({
  name: isInvalidName(scenario.name),
  description: isInvalidString(SMALL_TEXT_AREA_MAX_LENGTH, scenario.description),
});

export default checkScenarioFields;
