import { v4 as uuidv4 } from 'uuid';

import type { Infra, Project, Scenario, Study, TimetableResult } from 'common/api/osrdEditoastApi';

import { getInfra, getProject, getStudy, postApiRequest } from './api-setup';
import readJsonFile from './file-utils';
import type { ScenarioData } from './types';

const scenarioData: ScenarioData = readJsonFile('tests/assets/operation-studies/scenario.json');

// Define the SetupResult interface to structure the returned setup data.
interface SetupResult {
  smallInfra: Infra;
  project: Project;
  study: Study;
  scenario: Scenario;
  timetableResult: TimetableResult;
}

/**
 * Set up a scenario by fetching required infrastructure, project, study, and creating a new scenario.
 *
 * @param electricalProfileId - Optional electrical profile ID for the scenario.
 * @returns {Promise<SetupResult>} - The setup result containing the infrastructure, project, study, scenario, and timetable result.
 */
export default async function createScenario(
  scenarioName?: string,
  projectId: number | null = null,
  studyId: number | null = null,
  infraId: number | null = null,
  electricalProfileId: number | null = null
): Promise<SetupResult> {
  // Fetch or create infrastructure
  const smallInfra: Infra = infraId ? ({ id: infraId } as Infra) : await getInfra();

  // Fetch or create project
  const project: Project = projectId ? ({ id: projectId } as Project) : await getProject();

  // Fetch or create study
  const study: Study = studyId ? ({ id: studyId } as Study) : await getStudy(project.id);

  // Create a new timetable result
  const timetableResult: TimetableResult = await postApiRequest(`/api/timetable`);

  // Create a new scenario with a unique name if not provided
  const scenarioNameFinal = scenarioName || `${scenarioData.name} ${uuidv4()}`;

  // Create a new scenario with the provided or generated name
  const scenario: Scenario = await postApiRequest(
    `/api/projects/${project.id}/studies/${study.id}/scenarios`,
    {
      ...scenarioData,
      name: scenarioNameFinal,
      infra_id: smallInfra.id,
      timetable_id: timetableResult.timetable_id,
      electrical_profile_set_id: electricalProfileId,
    },
    undefined,
    'Failed to create scenario'
  );

  // Return the result of the setup with all relevant details
  return {
    smallInfra,
    project,
    study,
    scenario,
    timetableResult,
  };
}
