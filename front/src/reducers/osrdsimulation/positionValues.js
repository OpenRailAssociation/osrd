import { LIST_VALUES_NAME_SPACE_TIME } from '../../applications/osrd/components/Simulation/consts';
import { UPDATE_TIME_POSITION_VALUES } from '../osrdsimulation';
import produce from 'immer';

export const UPDATE_POSITION_VALUES = 'osrdsimu/UPDATE_POSITION_VALUES';



export const initialState = {
  headPosition: 0,
  tailPosition: 0,
  routeEndOccupancy: 0,
  routeBeginOccupancy: 0,
  speed: 0,
};

export default function reducer(state = initialState, action, rootState) {
  return produce(state, (draft) => {
    // eslint-disable-next-line default-case
    switch (action.type) {
      case UPDATE_POSITION_VALUES:
      case UPDATE_TIME_POSITION_VALUES:
        const currentTrainSimulation = rootState.consolidatedSimulation.find(consolidatedSimulation => consolidatedSimulation.trainNumber === rootState.selectedTrain)
        const positionsValues = interpolateOnTime(
          currentTrainSimulation,
          ['time'],
          LIST_VALUES_NAME_SPACE_TIME,
          action.timePosition,
        );
        draft.headPosition = positionsValues.headPosition;
        draft.routeEndOccupancy = positionsValues.routeEndOccupancy;
        draft.routeBeginOccupancy = positionsValues.routeBeginOccupancy;
        draft.speed = positionsValues.speed;
       break;
      }

  });
}

export function updatePositionValues(positionValues) {
  return (dispatch) => {
    dispatch({
      type: UPDATE_POSITION_VALUES,
      positionValues,
    });
  };
}
