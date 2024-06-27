import type { TypedStartListening, ListenerEffectAPI } from '@reduxjs/toolkit';

import type { RootState } from 'reducers';
import type { AppDispatch } from 'store';

export type AppStartListening = TypedStartListening<RootState, AppDispatch>;
export type AppListenerEffectApi = ListenerEffectAPI<RootState, AppDispatch>;
