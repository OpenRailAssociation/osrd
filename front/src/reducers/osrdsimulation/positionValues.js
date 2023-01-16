import produce from 'immer';
import { LIST_VALUES_NAME_SPACE_TIME } from '../../applications/osrd/components/Simulation/consts';
import { UPDATE_TIME_POSITION_VALUES } from '../osrdsimulation';

export const UPDATE_POSITION_VALUES = 'osrdsimu/UPDATE_POSITION_VALUES';

export const initialState = {
  headPosition: 0,
  tailPosition: 0,
  routeEndOccupancy: 0,
  routeBeginOccupancy: 0,
  speed: 0,
};

export default function reducer(inputState, action, rootState) {
  const state = inputState || initialState;

  return produce(state, (draft) => {
    switch (action.type) {
      case UPDATE_POSITION_VALUES:
      case UPDATE_TIME_POSITION_VALUES: {
        const currentTrainSimulation = rootState.consolidatedSimulation.find(
          (consolidatedSimulation) => consolidatedSimulation.trainNumber === rootState.selectedTrain
        );
        const positionsValues = interpolateOnTime(
          currentTrainSimulation,
          ['time'],
          LIST_VALUES_NAME_SPACE_TIME,
          action.timePosition
        );
        draft.headPosition = positionsValues.headPosition;
        draft.speed = positionsValues.speed;
        break;
      }
      default:
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
