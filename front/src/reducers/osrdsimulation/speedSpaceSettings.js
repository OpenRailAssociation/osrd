import produce from 'immer';

export const UPDATE_SPEEDSPACE_SETTINGS = 'osrdsimu/UPDATE_SPEEDSPACE_SETTINGS';

// Reducer
export const initialState = {
  altitude: false,
  curves: false,
  maxSpeed: true,
  slopes: false,
};

export default function reducer(state = initialState, action) {
  return produce(state, (draft) => {
    // eslint-disable-next-line default-case
    switch (action.type) {
      case UPDATE_SPEEDSPACE_SETTINGS:
        draft.altitude = action.speedSpaceSettings.altitude;
        draft.curves = action.speedSpaceSettings.curves;
        draft.maxSpeed = action.speedSpaceSettings.maxSpeed;
        draft.slopes = action.speedSpaceSettings.slopes;
        break;
    }
  });
}

export function updateSpeedSpaceSettings(speedSpaceSettings) {
  return (dispatch) => {
    dispatch({
      type: UPDATE_SPEEDSPACE_SETTINGS,
      speedSpaceSettings,
    });
  };
}
