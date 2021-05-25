/* eslint-disable default-case */
import produce from 'immer';
import { get } from 'common/requests';

// Action Types
export const GET_MATERIEL = 'traincompo/GET_MATERIEL';
export const GET_BASEGOC = 'traincompo/GET_BASEGOC';

// Reducer
export const initialState = {
  materiel: {},
  basegoc: {},
};

export default function reducer(state = initialState, action) {
  return produce(state, (draft) => {
    switch (action.type) {
      case GET_MATERIEL:
        draft.materiel = action.materiel;
        break;
      case GET_BASEGOC:
        draft.basegoc = action.basegoc;
        break;
    }
  });
}

// Functions
export function setMateriel(materiel) {
  return (dispatch) => {
    dispatch({
      type: GET_MATERIEL,
      materiel,
    });
  };
}
export function setBaseGoc(basegoc) {
  return (dispatch) => {
    dispatch({
      type: GET_BASEGOC,
      basegoc,
    });
  };
}

export function getMateriel() {
  return async (dispatch) => {
    try {
      const materiel = await get('/matr/index/');
      // const materielNEW = await get('/osrd/matr/index/', undefined, true);
      // console.log(materielNEW);
      dispatch(setMateriel(materiel));
      return materiel;
    } catch (e) {
      console.log(e);
    }
    return {};
  };
}
export function getBaseGoc(codenbengin) {
  return async (dispatch) => {
    try {
      const basegoc = await get('/matr/materielroulant/', { codenbengin });
      dispatch(setBaseGoc(basegoc));
      return basegoc.results[0]; // Only one response possible
    } catch (e) {
      console.log(e);
    }
    return {};
  };
}
