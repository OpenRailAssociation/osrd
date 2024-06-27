import { createListenerMiddleware, addListener } from '@reduxjs/toolkit';
import type { TypedAddListener } from '@reduxjs/toolkit';

import type { RootState } from 'reducers';
import type { AppDispatch } from 'store';

import add403HttpErrorListener from './authorization';
import { type AppStartListening } from './types';
import addUserListeners from './user';

export const listenerMiddleware = createListenerMiddleware();
export const startAppListening = listenerMiddleware.startListening as AppStartListening;
export const addAppListener = addListener as TypedAddListener<RootState, AppDispatch>;

addUserListeners(startAppListening);
add403HttpErrorListener(startAppListening);
