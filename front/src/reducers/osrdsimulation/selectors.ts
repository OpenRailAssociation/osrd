import type { RootState } from 'reducers';
import { makeSubSelector } from 'utils/selectors';

import type { OsrdSimulationState } from './types';

export const getOsrdSimulation = (state: RootState) => state.osrdsimulation;

const makeOsrdSimulationSelector = makeSubSelector<OsrdSimulationState>(getOsrdSimulation);

export const getIsPlaying = makeOsrdSimulationSelector('isPlaying');
export const getIsUpdating = makeOsrdSimulationSelector('isUpdating');
export const getSelectedTrainId = makeOsrdSimulationSelector('selectedTrainId');
export const getTrainIdUsedForProjection = makeOsrdSimulationSelector('trainIdUsedForProjection');
