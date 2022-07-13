import produce from 'immer';

export const UPDATE_CHART = 'osrdsimu/UPDATE_CHART';

// Reducer
export const initialState = null;

export default function reducer(state = initialState, action) {
  return produce(state, (draft) => {
    // eslint-disable-next-line default-case
    switch (action.type) {
      case UPDATE_CHART:
        draft.chart = action.payload;
        break;
    }
  });
}

