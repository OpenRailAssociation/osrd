import { RootState } from 'reducers';

export const getComfortLevel = (state: RootState) => state.rsEditorCurvesParams.comfortLvl;
export const getElectricalProfile = (state: RootState) =>
  state.rsEditorCurvesParams.electricalProfile;
export const getPowerRestriction = (state: RootState) =>
  state.rsEditorCurvesParams.powerRestriction;
export const getTractionMode = (state: RootState) => state.rsEditorCurvesParams.tractionMode;
