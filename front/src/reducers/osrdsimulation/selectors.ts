import { RootState } from 'reducers';
import { makeSubSelector } from 'utils/selectors';
import { SimulationReport } from 'common/api/osrdEditoastApi';
import { OsrdSimulationState, Train } from './types';

export const getOsrdSimulation = (state: RootState) => state.osrdsimulation;

const makeOsrdSimulationSelector = makeSubSelector<OsrdSimulationState>(getOsrdSimulation);

export const getIsPlaying = makeOsrdSimulationSelector('isPlaying');
export const getIsUpdating = makeOsrdSimulationSelector('isUpdating');
export const getAllowancesSettings = makeOsrdSimulationSelector('allowancesSettings');
export const getMustRedraw = makeOsrdSimulationSelector('mustRedraw');
export const getSelectedProjection = makeOsrdSimulationSelector('selectedProjection');
export const getSelectedTrainId = makeOsrdSimulationSelector('selectedTrainId');
export const getSpeedSpaceSettings = makeOsrdSimulationSelector('speedSpaceSettings');
export const getConsolidatedSimulation = makeOsrdSimulationSelector('consolidatedSimulation');
export const getDisplaySimulation = makeOsrdSimulationSelector('displaySimulation');

export const getPresentSimulation = (state: RootState) => state.osrdsimulation.simulation.present;

export const getSelectedTrain = (state: RootState) => {
  const { trains } = getPresentSimulation(state);
  const selectedTrainId = getSelectedTrainId(state);
  // TODO: delete this cast when we have chosen the appropriate type for the simulation
  return (trains as (SimulationReport | Train)[]).find(
    (train) => train.id && train.id === selectedTrainId
  );
};
