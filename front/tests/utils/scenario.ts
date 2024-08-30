import { v4 as uuidv4 } from 'uuid';

import type {
  Infra,
  Project,
  ScenarioV2,
  Study,
  TimetableResult,
} from 'common/api/osrdEditoastApi';

import { getInfra, getProject, getStudy, postApiRequest } from './api-setup';
import scenarioData from '../assets/operationStudies/scenario.json';

// Define the SetupResult interface
interface SetupResult {
  smallInfra: Infra;
  project: Project;
  study: Study;
  scenario: ScenarioV2;
  timetableResult: TimetableResult;
}

// Define the setupScenario function
export default async function setupScenario(): Promise<SetupResult> {
  // Fetch infrastructure, project, study, and timetable result
  const smallInfra = (await getInfra()) as Infra;
  const project = await getProject();
  const study = await getStudy(project.id);
  const timetableResult = await postApiRequest(`/api/v2/timetable/`);

  // Create a new scenario with a unique name
  const scenario = await postApiRequest(
    `/api/v2/projects/${project.id}/studies/${study.id}/scenarios/`,
    {
      ...scenarioData,
      name: `${scenarioData.name} ${uuidv4()}`,
      study_id: study.id,
      infra_id: smallInfra.id,
      timetable_id: timetableResult.timetable_id,
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
