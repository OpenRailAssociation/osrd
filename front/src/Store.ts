import { applyMiddleware, compose, createStore } from 'redux';
import { composeWithDevTools, Config } from '@redux-devtools/extension';

import { persistStore } from 'redux-persist';
import persistedReducer from 'reducers';
import thunk from 'redux-thunk';

const reduxDevToolsOptions: Config = {
  serialize: {
    options: {
      symbol: true,
    },
  },
};

// const composeEnhancers = composeWithDevToolsLogOnlyInProduction(reduxDevToolsOptions);
const composeEnhancers = composeWithDevTools(reduxDevToolsOptions) || compose;

const enhancers = composeEnhancers(applyMiddleware(thunk));
const store = createStore(persistedReducer, enhancers);

const persistor = persistStore(store);

export { store, persistor };
