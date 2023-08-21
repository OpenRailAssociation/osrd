import { RootState } from 'reducers';

export const getComfortLevel = (state: RootState) => state.rsEditorCurvesParams.comfortLvl;
export const getTractionMode = (state: RootState) => state.rsEditorCurvesParams.tractionMode;
export const getElectricalProfile = (state: RootState) =>
  state.rsEditorCurvesParams.electricalProfile;
