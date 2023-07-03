import { RootState } from 'reducers';
import { makeSubSelector } from 'utils/selectors';
import { OsrdSimulationState } from './types';

export const getOsrdSimulation = (state: RootState) => state.osrdsimulation;

export const getAllowancesSettings = makeSubSelector<OsrdSimulationState, 'allowancesSettings'>(
  getOsrdSimulation,
  'allowancesSettings'
);
export const getIsPlaying = makeSubSelector<OsrdSimulationState, 'isPlaying'>(
  getOsrdSimulation,
  'isPlaying'
);
export const getMustRedraw = makeSubSelector<OsrdSimulationState, 'mustRedraw'>(
  getOsrdSimulation,
  'mustRedraw'
);
export const getPositionValues = makeSubSelector<OsrdSimulationState, 'positionValues'>(
  getOsrdSimulation,
  'positionValues'
);
export const getSelectedProjection = makeSubSelector<OsrdSimulationState, 'selectedProjection'>(
  getOsrdSimulation,
  'selectedProjection'
);
export const getSelectedTrainId = makeSubSelector<OsrdSimulationState, 'selectedTrainId'>(
  getOsrdSimulation,
  'selectedTrainId'
);

export const getTimePosition = makeSubSelector<OsrdSimulationState, 'timePosition'>(
  getOsrdSimulation,
  'timePosition'
);
export const getConsolidatedSimulation = makeSubSelector<
  OsrdSimulationState,
  'consolidatedSimulation'
>(getOsrdSimulation, 'consolidatedSimulation');
export const getPresentSimulation = (state: RootState) => state.osrdsimulation.simulation.present;

export const getSelectedTrain = (state: RootState) => {
  const { trains } = getPresentSimulation(state);
  const selectedTrainId = getSelectedTrainId(state);
  return trains.find((train) => train.id && train.id === selectedTrainId);
};
