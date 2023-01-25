import { RootState } from 'reducers';

export const getAllowancesSettings = (state: RootState) => state.osrdsimulation.allowancesSettings;
export const getMustRedraw = (state: RootState) => state.osrdsimulation.mustRedraw; //should disappear
export const getPositionValues = (state: RootState) => state.osrdsimulation.positionValues;
export const getSelectedProjection = (state: RootState) => state.osrdsimulation.selectedProjection;
export const getSelectedTrain = (state: RootState) => state.osrdsimulation.selectedTrain;
export const getTimePosition = (state: RootState) => state.osrdsimulation.timePosition;
export const getConsolidatedSimulation = (state: RootState) => state.osrdsimulation.consolidatedSimulation;
export const getPresentSimulation = (state: RootState) => state.osrdsimulation.simulation.present;
