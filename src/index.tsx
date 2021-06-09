import React from 'react';
import ReactDOM from 'react-dom';
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import * as serviceWorker from 'serviceWorker';
import { store, persistor } from 'Store';

// Components
import App from 'main/App';
import Loader from 'common/Loader';

// Styles and translation
import './i18n';
import 'config/variables.css';
import 'main/App/App.scss';
import '@sncf/bootstrap-sncf.metier/dist/bootstrap-sncf.min.css';
import 'mapbox-gl/dist/mapbox-gl.css';

// Sentry
import * as Sentry from '@sentry/browser';

import { version } from '../package.json';

// Must be required and not imported to be included in production build (strange bug ?)
require('@sncf/bootstrap-sncf.metier');

Sentry.init({
  dsn: 'https://6797a40408f64fc5a38f1d894cf29a50@sentry.shared.dgexsol.fr/4',
  environment: 'dev',
});

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
