import type { RootState } from 'reducers';
import buildInfraStateSelectors, { type InfraStateSelectors } from 'reducers/infra/selectors';
import type { OperationalStudiesConfSlice } from 'reducers/osrdconf/operationalStudiesConf';
import type { StdcmConfSlice } from 'reducers/osrdconf/stdcmConf';
import { makeSubSelector } from 'utils/selectors';

import type { OsrdConfState } from '../types';

type SelectorResults = {
  ProjectID: OsrdConfState['projectID'];
  StudyID: OsrdConfState['studyID'];
  ScenarioID: OsrdConfState['scenarioID'];
  TimetableID: OsrdConfState['timetableID'];
  ElectricalProfileSetId: OsrdConfState['electricalProfileSetId'];
  RollingStockID: OsrdConfState['rollingStockID'];
  SpeedLimitByTag: OsrdConfState['speedLimitByTag'];
};

type Selectors<Name extends string> = {
  [Result in keyof SelectorResults as `get${Name}${string & Result}`]: (
    state: RootState
  ) => SelectorResults[Result];
};

type CommonSelectors<Name extends string> = Selectors<Name> & InfraStateSelectors<Name>;

/**
 * This function builds a predefined collection of selectors on a given slice. It is possible to add
 * a name so that the selectors have custom names, to clarify how to use them later.
 *
 * For instance, you can use it as:
 * - `buildCommonConfSelectors(someSlice).getProjectID`
 * - `buildCommonConfSelectors(someSlice, 'Stdcm').getStdcmProjectID`
 */
function buildCommonConfSelectors(
  slice: OperationalStudiesConfSlice | StdcmConfSlice
): CommonSelectors<''>;
function buildCommonConfSelectors<Name extends string>(
  slice: OperationalStudiesConfSlice | StdcmConfSlice,
  name: Name
): CommonSelectors<Name>;
function buildCommonConfSelectors<Name extends string>(
  slice: OperationalStudiesConfSlice | StdcmConfSlice,
  name?: Name
): CommonSelectors<Name> {
  const makeOsrdConfSelector = makeSubSelector((state: RootState) => state[slice.name]);

  const infraSelector = buildInfraStateSelectors(slice, name || '');

  const additionalSelectors = {
    [`get${name || ''}ProjectID`]: makeOsrdConfSelector('projectID'),
    [`get${name || ''}StudyID`]: makeOsrdConfSelector('studyID'),
    [`get${name || ''}ScenarioID`]: makeOsrdConfSelector('scenarioID'),
    [`get${name || ''}TimetableID`]: makeOsrdConfSelector('timetableID'),
    [`get${name || ''}ElectricalProfileSetId`]: makeOsrdConfSelector('electricalProfileSetId'),
    [`get${name || ''}RollingStockID`]: makeOsrdConfSelector('rollingStockID'),
    [`get${name || ''}SpeedLimitByTag`]: makeOsrdConfSelector('speedLimitByTag'),
  } as Selectors<Name>;

  return { ...infraSelector, ...additionalSelectors };
}

export default buildCommonConfSelectors;
