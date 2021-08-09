/* eslint-disable default-case */
import produce from 'immer';

// Action Types
export const SET_MATERIEL = 'rollingstock/SET_MATERIEL';
export const SET_BASEGOC = 'rollingstock/SET_BASEGOC';

// Reducer
export const initialState = {
  materiel: {},
  basegoc: {},
};

export default function reducer(state = initialState, action) {
  return produce(state, (draft) => {
    switch (action.type) {
      case SET_MATERIEL:
        draft.materiel = action.materiel;
        break;
      case SET_BASEGOC:
        draft.basegoc = action.basegoc;
        break;
    }
  });
}

// Functions
export function setMateriel(materiel) {
  return (dispatch) => {
    dispatch({
      type: SET_MATERIEL,
      materiel,
    });
  };
}
export function setBaseGoc(basegoc) {
  return (dispatch) => {
    dispatch({
      type: SET_BASEGOC,
      basegoc,
    });
  };
}
