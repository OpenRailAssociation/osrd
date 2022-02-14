// Styles
import 'config/variables.css';
import 'main/App/App.scss';
import 'mapbox-gl/dist/mapbox-gl.css';

// Sentry
import * as Sentry from '@sentry/browser';
import * as serviceWorker from 'serviceWorker';

import { persistor, store } from 'Store';

// Components
import App from 'main/App';
import { Integrations } from '@sentry/tracing';
import Loader from 'common/Loader';
import { PersistGate } from 'redux-persist/integration/react';
import { Provider } from 'react-redux';
import React from 'react';
import ReactDOM from 'react-dom';
import { version } from '../package.json';

// Must be required and not imported to be included in production build (strange bug ?)
require('@sncf/bootstrap-sncf.metier.reseau');

/*
Sentry.init({
  dsn: 'https://c810d004df0446b7b7a5bbfee21541cc@sentry-testing.shared.dgexsol.fr/36',
  environment: 'dev',
  autoSessionTracking: true,
  integrations: [
    new Integrations.BrowserTracing(),
  ],
});
*/

export default function Container() {
  console.log('OSRD VERSION', version);
  return (
    <Provider store={store}>
      <PersistGate loading={<Loader />} persistor={persistor}>
        <App />
      </PersistGate>
    </Provider>
  );
}

ReactDOM.render(<Container />, document.getElementById('root'));

// If you want your app to work offline and load faster, you can change
// unregister() to register() below. Note this comes with some pitfalls.
// Learn more about service workers: https://bit.ly/CRA-PWA
serviceWorker.unregister();
