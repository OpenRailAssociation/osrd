import ReactDOM from 'react-dom/client';
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';

// Styles
import 'maplibre-gl/dist/maplibre-gl.css';
import 'styles/styles.scss';

import { Loader } from 'common/Loaders';
import App from 'main/app';
import { persistor, store } from 'store';

// Components
import { version } from '../package.json';

export default function Container() {
  console.info('OSRD VERSION', version);

  return (
    <Provider store={store}>
      <PersistGate loading={<Loader />} persistor={persistor}>
        <App />
      </PersistGate>
    </Provider>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);
root.render(<Container />);
