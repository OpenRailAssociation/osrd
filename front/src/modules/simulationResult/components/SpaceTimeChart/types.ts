import { SimulationSnapshot } from 'reducers/osrdsimulation/types';

export type DispatchUpdateSelectedTrainId = (selectedTrainId: number) => void;
export type DispatchPersistentUpdateSimulation = (simulation: SimulationSnapshot) => void;
