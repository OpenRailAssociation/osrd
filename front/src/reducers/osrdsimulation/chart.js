import produce from 'immer';

export const UPDATE_CHART = 'osrdsimu/UPDATE_CHART';

// Reducer
export const initialState = {};

export default function reducer(inputState, action) {
  const state = inputState || initialState;

  return produce(state, (draft) => {
    // eslint-disable-next-line default-case
    switch (action.type) {
      case UPDATE_CHART:
        draft.chart = action.payload;
        break;
    }
  });
}
