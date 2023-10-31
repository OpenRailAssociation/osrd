import type { CaseReducer, Draft, PayloadAction } from '@reduxjs/toolkit';

export interface InfraState {
  infraID: number | undefined;
}

export const infraState: InfraState = {
  infraID: undefined,
};

export interface InfraStateReducers<S extends InfraState> {
  ['updateInfraID']: CaseReducer<S, PayloadAction<S['infraID']>>;
}

export function buildInfraStateReducers<S extends InfraState>(): InfraStateReducers<S> {
  return {
    updateInfraID(state: Draft<S>, action: PayloadAction<S['infraID']>) {
      state.infraID = action.payload;
    },
  };
}
