import { STANDARD_COMFORT_LEVEL } from 'applications/rollingStockEditor/consts';
import { Comfort } from 'common/api/osrdEditoastApi';
import produce from 'immer';
import { AnyAction, Dispatch } from 'redux';

// Action types
export const COMFORT_LEVEL = 'rollingstock/COMFORT_LEVEL';
export const TRACTION_MODE = 'rollingstock/TRACTION_MODE';
export const ELECTRICAL_PROFILE = 'rollingstock/ELECTRICAL_PROFILE';

export interface RsEditorCurvesState {
  comfortLvl: Comfort;
  tractionMode: string;
  electricalProfile: string | null;
}

export const initialState: RsEditorCurvesState = {
  comfortLvl: STANDARD_COMFORT_LEVEL,
  tractionMode: '',
  electricalProfile: null,
};

export default function reducer(inputState: RsEditorCurvesState | undefined, action: AnyAction) {
  const state = inputState || initialState;
  return produce(state, (draft) => {
    switch (action.type) {
      case COMFORT_LEVEL:
        draft.comfortLvl = action.comfortLvl;
        return draft;
      case TRACTION_MODE:
        draft.tractionMode = action.tractionMode;
        return draft;
      case ELECTRICAL_PROFILE:
        draft.electricalProfile = action.electricalProfile;
        return draft;
      default:
        return draft;
    }
  });
}

export function updateComfortLvl(comfortLvl: Comfort) {
  return (dispatch: Dispatch) => {
    dispatch({
      type: COMFORT_LEVEL,
      comfortLvl,
    });
  };
}

export function updateTractionMode(tractionMode: string) {
  return (dispatch: Dispatch) => {
    dispatch({
      type: TRACTION_MODE,
      tractionMode,
    });
  };
}

export function updateElectricalProfile(electricalProfile: string) {
  return (dispatch: Dispatch) => {
    dispatch({
      type: ELECTRICAL_PROFILE,
      electricalProfile,
    });
  };
}
