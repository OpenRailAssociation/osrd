import { osrdEditoastApi, type StudyWithScenarios } from 'common/api/osrdEditoastApi';
import { cleanScenarioLocalStorage } from 'modules/scenario/helpers/utils';
import type { AppDispatch } from 'store';

const cleanLocalStorageByProject = async (
  projectId: number,
  projectStudies: StudyWithScenarios[],
  dispatch: AppDispatch
) => {
  const promisedScenarios = projectStudies.map(async (study) => {
    const data = await dispatch(
      osrdEditoastApi.endpoints.getProjectsByProjectIdStudiesAndStudyIdScenarios.initiate({
        projectId,
        studyId: study.id,
      })
    ).unwrap();
    return data?.results;
  });

  const scenarios = await Promise.all(promisedScenarios);

  scenarios.flat().forEach((scenario) => {
    if (scenario) cleanScenarioLocalStorage(scenario.timetable_id);
  });
};

export default cleanLocalStorageByProject;
