import { useSelector } from 'react-redux';
import { useAppDispatch } from 'store';
import { updateSelectedTrainId } from 'reducers/osrdsimulation/actions';
import {
  getAllowancesSettings,
  getIsPlaying,
  getPresentSimulation,
  getSelectedProjection,
  getSelectedTrain,
} from 'reducers/osrdsimulation/selectors';
import { persistentUpdateSimulation } from 'reducers/osrdsimulation/simulation';
import { SimulationSnapshot } from 'reducers/osrdsimulation/types';

export const useStoreDataForSpaceTimeChart = () => {
  const dispatch = useAppDispatch();

  return {
    allowancesSettings: useSelector(getAllowancesSettings),
    selectedTrain: useSelector(getSelectedTrain),
    selectedProjection: useSelector(getSelectedProjection),
    simulation: useSelector(getPresentSimulation),
    simulationIsPlaying: useSelector(getIsPlaying),
    dispatchUpdateSelectedTrainId: (_selectedTrainId: number) => {
      dispatch(updateSelectedTrainId(_selectedTrainId));
    },
    dispatchPersistentUpdateSimulation: (simulation: SimulationSnapshot) => {
      dispatch(persistentUpdateSimulation(simulation));
    },
  };
};

export default useStoreDataForSpaceTimeChart;
