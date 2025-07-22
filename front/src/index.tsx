import ReactDOM from 'react-dom/client';
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';

import 'maplibre-gl/dist/maplibre-gl.css';
import 'styles/styles.scss';

import { Loader } from 'common/Loaders';
import App from 'main/app';
import { persistor, store } from 'store';

export default function Container() {
  return (
    <Provider store={store}>
      <PersistGate loading={<Loader />} persistor={persistor}>
        <App />
      </PersistGate>
    </Provider>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(<Container />);
