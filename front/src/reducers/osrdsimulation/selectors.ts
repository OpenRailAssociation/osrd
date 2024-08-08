import type { SimulationReport } from 'common/api/osrdEditoastApi';
import type { RootState } from 'reducers';
import { makeSubSelector } from 'utils/selectors';

import type { OsrdSimulationState, Train } from './types';

export const getOsrdSimulation = (state: RootState) => state.osrdsimulation;

const makeOsrdSimulationSelector = makeSubSelector<OsrdSimulationState>(getOsrdSimulation);

export const getIsPlaying = makeOsrdSimulationSelector('isPlaying');
export const getIsUpdating = makeOsrdSimulationSelector('isUpdating');
export const getSelectedTrainId = makeOsrdSimulationSelector('selectedTrainId');
export const getTrainIdUsedForProjection = makeOsrdSimulationSelector('trainIdUsedForProjection');

export const getPresentSimulation = (state: RootState) => state.osrdsimulation.simulation.present;

export const getSelectedTrain = (state: RootState) => {
  const { trains } = getPresentSimulation(state);
  const selectedTrainId = getSelectedTrainId(state);
  // TODO: delete this cast when we have chosen the appropriate type for the simulation
  return (trains as (SimulationReport | Train)[]).find(
    (train) => train.id && train.id === selectedTrainId
  );
};
