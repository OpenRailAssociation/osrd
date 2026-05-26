import type { RootState } from 'reducers';
import { makeSubSelector } from 'utils/selectors';

import type { SimulationResultsState } from './types';

export const getSimulationResults = (state: RootState) => state.simulation;

const makeOsrdSimulationSelector = makeSubSelector<SimulationResultsState>(getSimulationResults);

export const getDisplayOnlyPathSteps = makeOsrdSimulationSelector('displayOnlyPathSteps');
export const getSelectedTrain = (state: RootState) => state.simulation.selectedTrain;
export const getHoveredTrainId = makeOsrdSimulationSelector('hoveredTrainId');
export const getTrainIdUsedForProjection = makeOsrdSimulationSelector('trainIdUsedForProjection');
export const getProjectionType = makeOsrdSimulationSelector('projectionType');
export const getIsSimulationEnabled = makeOsrdSimulationSelector('isSimulationEnabled');
