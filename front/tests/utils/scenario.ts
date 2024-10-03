import { v4 as uuidv4 } from 'uuid';

import type { Infra, Project, Scenario, Study, TimetableResult } from 'common/api/osrdEditoastApi';

import { getInfra, getProject, getStudy, postApiRequest } from './api-setup';
import scenarioData from '../assets/operationStudies/scenario.json';

// Define the SetupResult interface
interface SetupResult {
  smallInfra: Infra;
  project: Project;
  study: Study;
  scenario: Scenario;
  timetableResult: TimetableResult;
}

// Define the setupScenario function
export default async function setupScenario(
  electricalProfileId: number | null = null
): Promise<SetupResult> {
  // Fetch infrastructure, project, study, and timetable result
  const smallInfra = await getInfra('small_infra_test_e2e');
  const project = await getProject('project_test_e2e');
  const study = await getStudy(project.id, 'study_test_e2e');
  const timetableResult = await postApiRequest(`/api/timetable/`);

  // Create a new scenario with a unique name
  const scenario = await postApiRequest(
    `/api/projects/${project.id}/studies/${study.id}/scenarios/`,
    {
      ...scenarioData,
      name: `${scenarioData.name} ${uuidv4()}`,
      study_id: study.id,
      infra_id: smallInfra.id,
      timetable_id: timetableResult.timetable_id,
      electrical_profile_set_id: electricalProfileId,
    }
  );

  return {
    smallInfra,
    project,
    study,
    scenario,
    timetableResult,
  };
}
