import { createStore, applyMiddleware } from 'redux';
import thunk from 'redux-thunk';
import { persistStore } from 'redux-persist';

import persistedReducer from 'reducers';

const store = createStore(
  persistedReducer,
  applyMiddleware(
    thunk,
  ),
);

const persistor = persistStore(store);

export {
  store,
  persistor,
};
