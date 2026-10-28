import type { Config } from '@redux-devtools/extension';
import { configureStore } from '@reduxjs/toolkit';
import { type TypedUseSelectorHook, useDispatch, useSelector } from 'react-redux';
import { persistStore, getStoredState } from 'redux-persist';

import persistedReducer, { type RootState, persistConfig } from 'reducers';

import { listenerMiddleware } from './listeners/listenerMiddleware';
import { middlewares } from './middlewares';

const reduxDevToolsOptions: Config = {
  serialize: {
    options: {
      symbol: true,
    },
  },
};

const createStore = () =>
  configureStore({
    reducer: persistedReducer,
    devTools: reduxDevToolsOptions,
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({
        serializableCheck: false,
        // The following line disables the detection of immutability across the entire Redux state.
        // Immutability detection can be time-consuming, especially for large stores
        // and can show warning message : "ImmutableStateInvariantMiddleware took xms, which is more than the warning threshold of 32ms."
        // Since we use RTK, which incorporates Immer for managing our store slices,
        // this check is not really necessary since Immer has already ensured the store immutability.
        // Disabling this feature improve performance. https://github.com/reduxjs/redux-toolkit/issues/415
        immutableCheck: false,
      })
        .prepend(listenerMiddleware.middleware)
        .concat(...middlewares),
  });

const store = createStore();

export type AppDispatch = typeof store.dispatch;
export type GetState = typeof store.getState;
export type Store = typeof store;

export const useAppDispatch: () => AppDispatch = useDispatch;
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;

const persistor = persistStore(store);

// Retrieve the persisted state from storage and purge if new front version
async function purgeStorageOnNewVersion() {
  try {
    const persistedState = await getStoredState(persistConfig);

    console.info('Front OSRD Version', import.meta.env.VITE_OSRD_GIT_DESCRIBE);

    const envInterfaceVersion = import.meta.env.VITE_OSRD_GIT_DESCRIBE;
    const persistedRootState = persistedState as RootState;

    if (
      envInterfaceVersion &&
      persistedRootState?.main?.lastInterfaceVersion !== envInterfaceVersion
    ) {
      await persistor.purge();
      console.warn('New Front Version since last launch, persisted Store purged');
    }
  } catch (err) {
    console.error('Error retrieving persisted state:', err);
  }
}

void purgeStorageOnNewVersion();

export { store, persistor, createStore };
