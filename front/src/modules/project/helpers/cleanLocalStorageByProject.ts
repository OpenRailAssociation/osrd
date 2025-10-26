import { osrdEditoastApi, type StudyWithScenarios } from 'common/api/osrdEditoastApi';
import { cleanScenarioLocalStorage } from 'modules/scenario/helpers/utils';
import type { AppDispatch } from 'store';

const cleanLocalStorageByProject = async (
  projectStudies: StudyWithScenarios[],
  dispatch: AppDispatch
) => {
  const promisedScenarios = projectStudies.map(async (study) => {
    const data = await dispatch(
      osrdEditoastApi.endpoints.getScenarios.initiate({
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
