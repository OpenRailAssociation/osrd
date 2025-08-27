import type { CaseReducer, Draft, PayloadAction } from '@reduxjs/toolkit';

import type { Infra } from 'common/api/osrdEditoastApi';

export type InfraState = {
  infraID: number | undefined;
  infraIsLocked: boolean;
};

export const infraState: InfraState = {
  infraID: undefined,
  infraIsLocked: false,
};

export type InfraStateReducers<S extends InfraState> = {
  ['updateInfraID']: CaseReducer<S, PayloadAction<S['infraID']>>;
  ['updateInfra']: CaseReducer<S, PayloadAction<Infra>>;
};

export function buildInfraStateReducers<S extends InfraState>(): InfraStateReducers<S> {
  return {
    updateInfraID(state: Draft<S>, action: PayloadAction<S['infraID']>) {
      state.infraID = action.payload;
    },
    updateInfra(state: Draft<S>, action: PayloadAction<Infra>) {
      state.infraID = action.payload.id;
      state.infraIsLocked = action.payload.locked;
    },
  };
}
