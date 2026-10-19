import { configureStore } from '@reduxjs/toolkit';

import { rootInitialState, rootReducer, type RootState } from 'reducers';

import { listenerMiddleware } from './listeners/listenerMiddleware';
import { middlewares } from './middlewares';

export const createStoreWithoutMiddleware = (initialStateExtra: Partial<RootState>) =>
  configureStore({
    reducer: rootReducer,
    preloadedState: {
      ...rootInitialState,
      ...initialStateExtra,
    },
  });

export const createTransientStore = (initialStateExtra?: Partial<RootState>) =>
  configureStore({
    reducer: rootReducer,
    preloadedState: {
      ...rootInitialState,
      ...initialStateExtra,
    },
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({
        serializableCheck: false,
        // See createStore in ./index.ts
        immutableCheck: false,
      })
        .prepend(listenerMiddleware.middleware)
        .concat(...middlewares),
  });
