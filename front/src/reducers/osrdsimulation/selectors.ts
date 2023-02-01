import { RootState } from 'reducers';
import { makeSubSelector } from 'utils/selectors';
import { OsrdSimulationState } from './types';

export const getOsrdSimulation = (state: RootState) => state.osrdsimulation;

export const getAllowancesSettings = makeSubSelector<OsrdSimulationState, 'allowancesSettings'>(
  getOsrdSimulation,
  'allowancesSettings'
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
export const getSelectedTrain = makeSubSelector<OsrdSimulationState, 'selectedTrain'>(
  getOsrdSimulation,
  'selectedTrain'
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
