import produce from 'immer';

import { UPDATE_TIME_POSITION_VALUES } from '../osrdsimulation';

export const UPDATE_POSITION_VALUES = 'osrdsimu/UPDATE_POSITION_VALUES';

export const initialState = {
  headPosition: 0,
  tailPosition: 0,
  routeEndOccupancy: 0,
  routeBeginOccupancy: 0,
};

export default function reducer(state = initialState, action) {
  return produce(state, (draft) => {
    // eslint-disable-next-line default-case
    switch (action.type) {
      case UPDATE_POSITION_VALUES:
      case UPDATE_TIME_POSITION_VALUES:
        draft.headPosition = action.positionValues.headPosition;
        draft.tailPosition = action.positionValues.tailPosition;
        draft.routeEndOccupancy = action.positionValues.routeEndOccupancy;
        draft.routeBeginOccupancy = action.positionValues.routeBeginOccupancy;
        break;
      default:
        return draft;
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
