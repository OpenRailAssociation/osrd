import type { RootState } from 'reducers';
import { makeSubSelector } from 'utils/selectors';

import type { SimulationResultsState } from './types';

export const getSimulationResults = (state: RootState) => state.simulation;

const makeOsrdSimulationSelector = makeSubSelector<SimulationResultsState>(getSimulationResults);

export const getDisplayOnlyPathSteps = makeOsrdSimulationSelector('displayOnlyPathSteps');
export const getSelectedTrainId = makeOsrdSimulationSelector('selectedTrainId');
export const getTrainIdUsedForProjection = makeOsrdSimulationSelector('trainIdUsedForProjection');
export const getProjectionType = makeOsrdSimulationSelector('projectionType');
