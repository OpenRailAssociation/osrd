/* eslint-disable default-case */
import { AnyAction, Dispatch } from 'redux';
import produce from 'immer';

// Action Types
export const SET_MATERIEL = 'rollingstock/SET_MATERIEL';
export const SET_BASEGOC = 'rollingstock/SET_BASEGOC';

export interface RollingStockState {
  materiel: Record<string, any>;
  basegoc: Record<string, any>;
}
// Reducer
export const initialState: RollingStockState = {
  materiel: {},
  basegoc: {},
};

export default function reducer(inputState: RollingStockState | undefined, action: AnyAction) {
  const state = inputState || initialState;
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
export function setMateriel(materiel: any) {
  return (dispatch: Dispatch) => {
    dispatch({
      type: SET_MATERIEL,
      materiel,
    });
  };
}
export function setBaseGoc(basegoc: any) {
  return (dispatch: Dispatch) => {
    dispatch({
      type: SET_BASEGOC,
      basegoc,
    });
  };
}
