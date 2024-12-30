import type { RootState } from 'reducers';
import buildInfraStateSelectors from 'reducers/infra/selectors';
import type { OperationalStudiesConfSlice } from 'reducers/osrdconf/operationalStudiesConf';
import type { StdcmConfSlice } from 'reducers/osrdconf/stdcmConf';
import { makeSubSelector } from 'utils/selectors';

const buildCommonConfSelectors = (slice: OperationalStudiesConfSlice | StdcmConfSlice) => {
  const makeOsrdConfSelector = makeSubSelector((state: RootState) => state[slice.name]);

  return {
    ...buildInfraStateSelectors(slice),
    getProjectID: makeOsrdConfSelector('projectID'),
    getStudyID: makeOsrdConfSelector('studyID'),
    getScenarioID: makeOsrdConfSelector('scenarioID'),
    getTimetableID: makeOsrdConfSelector('timetableID'),
    getElectricalProfileSetId: makeOsrdConfSelector('electricalProfileSetId'),
    getWorkScheduleGroupId: makeOsrdConfSelector('workScheduleGroupId'),
    getSearchDatetimeWindow: makeOsrdConfSelector('searchDatetimeWindow'),
    getRollingStockID: makeOsrdConfSelector('rollingStockID'),
    getSpeedLimitByTag: makeOsrdConfSelector('speedLimitByTag'),
  };
};

export default buildCommonConfSelectors;
