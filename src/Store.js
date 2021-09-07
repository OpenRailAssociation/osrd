import { createStore, applyMiddleware } from 'redux';
import {
  createStateSyncMiddleware,
  initMessageListener,
} from 'redux-state-sync';
import thunk from 'redux-thunk';
import { persistStore } from 'redux-persist';

import persistedReducer from 'reducers';

const store = createStore(
  persistedReducer,
  applyMiddleware(
    thunk,
    /* createStateSyncMiddleware({
      blacklist: ['persist/PERSIST', 'persist/REHYDRATE'],
    }), */
  ),
);

// initMessageListener(store);

const persistor = persistStore(store);

export {
  store,
  persistor,
};
