import { createSelector } from '@reduxjs/toolkit';
import { shallowEqual } from 'react-redux';

import type { RootState } from 'reducers';
import buildCommonConfSelectors from 'reducers/osrdconf/osrdConfCommon/selectors';
import { stdcmConfSlice } from 'reducers/osrdconf/stdcmConf';
import type { OsrdStdcmConfState } from 'reducers/osrdconf/types';
import { makeSubSelector } from 'utils/selectors';

const buildStdcmConfSelectors = () => {
  const getStdcmConf = (state: RootState) => state[stdcmConfSlice.name];
  const makeOsrdConfSelector = makeSubSelector<OsrdStdcmConfState>(getStdcmConf);

  const getStdcmPathSteps = makeOsrdConfSelector('stdcmPathSteps');
  const getStdcmSimulations = makeOsrdConfSelector('simulations');
  const getSelectedSimulationIndex = makeOsrdConfSelector('selectedSimulationIndex');

  const getSelectedSimulation = createSelector(
    [getStdcmSimulations, getSelectedSimulationIndex],
    (simulations, selectedIndex) => {
      if (selectedIndex === undefined || !simulations.at(selectedIndex)) {
        throw new Error('Can not retrieve the selected simulation');
      }
      return simulations[selectedIndex];
    },
    {
      memoizeOptions: {
        resultEqualityCheck: shallowEqual,
      },
    }
  );

  const getStdcmCompletedSimulations = createSelector([getStdcmSimulations], (simulations) =>
    simulations.filter((simulation) => simulation.outputs)
  );

  return {
    ...buildCommonConfSelectors(stdcmConfSlice),

    getStdcmConf,

    getMargins: makeOsrdConfSelector('margins'),
    getTotalMass: makeOsrdConfSelector('totalMass'),
    getTotalLength: makeOsrdConfSelector('totalLength'),
    getMaxSpeed: makeOsrdConfSelector('maxSpeed'),
    getLoadingGauge: makeOsrdConfSelector('loadingGauge'),
    getTowedRollingStockID: makeOsrdConfSelector('towedRollingStockID'),

    getStdcmPathSteps,
    getStdcmOrigin: (state: RootState) => {
      const pathSteps = getStdcmPathSteps(state);
      const origin = pathSteps.at(0);
      if (origin!.isVia) {
        throw new Error('Origin is a via point');
      }
      return origin!;
    },
    getStdcmDestination: (state: RootState) => {
      const pathSteps = getStdcmPathSteps(state);
      const destination = pathSteps.at(-1);
      if (destination!.isVia) {
        throw new Error('Destination is a via point');
      }
      return destination!;
    },
    getLinkedTrains: makeOsrdConfSelector('linkedTrains'),

    getStdcmSimulations,
    getStdcmCompletedSimulations,
    getSelectedSimulationIndex,
    getSelectedSimulation,
    getRetainedSimulationIndex: makeOsrdConfSelector('retainedSimulationIndex'),
    getMapSettings: makeOsrdConfSelector('mapSettings'),
    getWorkScheduleGroupId: makeOsrdConfSelector('workScheduleGroupId'),
    getActivePerimeter: makeOsrdConfSelector('activePerimeter'),
    getOperationalPoints: makeOsrdConfSelector('operationalPoints'),
    getSpeedLimitTags: makeOsrdConfSelector('speedLimitTags'),
    getDefaultSpeedLimitTag: makeOsrdConfSelector('defaultSpeedLimitTag'),

    // For some selectors, if data were missing, errors would have been thrown earlier, at startup.
    // The useStdcmEnv hook ensures that.
    getSearchDatetimeWindow: makeOsrdConfSelector('searchDatetimeWindow', { nonNullable: true }),
    getTimetableID: makeOsrdConfSelector('timetableID', { nonNullable: true }),
    getInfraID: makeOsrdConfSelector('infraID', { nonNullable: true }),
  };
};

const selectors = buildStdcmConfSelectors();

export const {
  getInfraID: getStdcmInfraID,
  getProjectID: getStdcmProjectID,
  getStudyID: getStdcmStudyID,
  getScenarioID: getStdcmScenarioID,
  getTimetableID: getStdcmTimetableID,
  getElectricalProfileSetId: getStdcmElectricalProfileSetId,
  getRollingStockID: getStdcmRollingStockID,
  getSpeedLimitByTag: getStdcmSpeedLimitByTag,

  getStdcmConf,

  getMargins,
  getTotalMass,
  getTotalLength,
  getMaxSpeed,
  getLoadingGauge,
  getTowedRollingStockID,
  getStdcmPathSteps,
  getStdcmOrigin,
  getStdcmDestination,
  getLinkedTrains,
  getStdcmSimulations,
  getStdcmCompletedSimulations,
  getSelectedSimulationIndex,
  getSelectedSimulation,
  getRetainedSimulationIndex,
  getWorkScheduleGroupId,
  getSearchDatetimeWindow,
  getActivePerimeter,
  getOperationalPoints,
  getSpeedLimitTags,
  getDefaultSpeedLimitTag,
} = selectors;

export type StdcmConfSelectors = typeof selectors;

export default selectors;
