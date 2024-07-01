import type { ScenarioForm } from './components/AddOrEditScenarioModal';

const checkScenarioFields = (
  scenario: ScenarioForm
): {
  name: boolean;
  description: boolean;
} => ({
  name: !scenario.name || scenario.name.length > 128,
  description: (scenario.description ?? '').length > 1024,
});

export default checkScenarioFields;
