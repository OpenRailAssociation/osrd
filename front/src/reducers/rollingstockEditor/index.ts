import { STANDARD_COMFORT_LEVEL } from 'modules/rollingStock/consts';
import { Comfort } from 'common/api/osrdEditoastApi';
import produce from 'immer';
import { AnyAction, Dispatch } from 'redux';

// Action types
export const COMFORT_LEVEL = 'rollingstock/COMFORT_LEVEL';
export const ELECTRICAL_PROFILE = 'rollingstock/ELECTRICAL_PROFILE';
export const POWER_RESTRICTION = 'rollingstock/POWER_RESTRICTION';
export const TRACTION_MODE = 'rollingstock/TRACTION_MODE';

export interface RsEditorCurvesState {
  comfortLvl: Comfort;
  electricalProfile: string | null;
  powerRestriction: string | null;
  tractionMode: string;
}

export const initialState: RsEditorCurvesState = {
  comfortLvl: STANDARD_COMFORT_LEVEL,
  electricalProfile: null,
  powerRestriction: null,
  tractionMode: '',
};

export default function reducer(inputState: RsEditorCurvesState | undefined, action: AnyAction) {
  const state = inputState || initialState;
  return produce(state, (draft) => {
    switch (action.type) {
      case COMFORT_LEVEL:
        draft.comfortLvl = action.comfortLvl;
        return draft;
      case ELECTRICAL_PROFILE:
        draft.electricalProfile = action.electricalProfile;
        return draft;
      case POWER_RESTRICTION:
        draft.powerRestriction = action.powerRestriction;
        return draft;
      case TRACTION_MODE:
        draft.tractionMode = action.tractionMode;
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

export function updateElectricalProfile(electricalProfile: string | null) {
  return (dispatch: Dispatch) => {
    dispatch({
      type: ELECTRICAL_PROFILE,
      electricalProfile,
    });
  };
}

export function updatePowerRestriction(powerRestriction: string | null) {
  return (dispatch: Dispatch) => {
    dispatch({
      type: POWER_RESTRICTION,
      powerRestriction,
    });
  };
}
