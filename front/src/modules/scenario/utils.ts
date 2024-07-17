import { checkFieldInvalidity, checkNameInvalidity } from 'applications/operationalStudies/utils';

import type { ScenarioForm } from './components/AddOrEditScenarioModal';

const checkScenarioFields = (
  scenario: ScenarioForm
): {
  name: boolean;
  description: boolean;
} => ({
  name: checkNameInvalidity(scenario.name),
  description: checkFieldInvalidity(1024, scenario.description),
});

export default checkScenarioFields;
