import { v4 as uuidv4 } from 'uuid';

import type { Infra, Project, Scenario, Study, TimetableResult } from 'common/api/osrdEditoastApi';

import { getInfra, getProject, getStudy, postApiRequest } from './api-setup';
import scenarioData from '../assets/operationStudies/scenario.json';

// Define the SetupResult interface to structure the returned setup data.
interface SetupResult {
  smallInfra: Infra;
  project: Project;
  study: Study;
  scenario: Scenario;
  timetableResult: TimetableResult;
}

/**
 * Sets up a scenario by fetching required infrastructure, project, study, and creating a new scenario.
 *
 * @param {number | null} [electricalProfileId=null] - Optional electrical profile ID for the scenario.
 * @returns {Promise<SetupResult>} - The setup result containing the infrastructure, project, study, scenario, and timetable result.
 */
export default async function createScenario(
  projectId: number | null = null,
  studyId: number | null = null,
  infraId: number | null = null,
  electricalProfileId: number | null = null
): Promise<SetupResult> {
  // Fetch or create infrastructure
  let smallInfra: Infra;
  if (!infraId) {
    smallInfra = await getInfra();
  } else {
    smallInfra = { id: infraId } as Infra;
  }

  // Fetch or create project
  let project: Project;
  if (!projectId) {
    project = await getProject();
  } else {
    project = { id: projectId } as Project;
  }

  // Fetch or create study
  let study: Study;
  if (!studyId) {
    study = await getStudy(project.id);
  } else {
    study = { id: studyId } as Study;
  }

  // Create a new timetable result
  const timetableResult = await postApiRequest(`/api/timetable/`);

  // Create a new scenario with a unique name using UUID
  const scenario: Scenario = await postApiRequest(
    `/api/projects/${project.id}/studies/${study.id}/scenarios/`,
    {
      ...scenarioData,
      name: `${scenarioData.name} ${uuidv4()}`, // Generating a unique name
      study_id: study.id,
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
