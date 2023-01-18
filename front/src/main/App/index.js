import { Suspense, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Route, Routes, unstable_HistoryRouter as HistoryRouter } from 'react-router-dom';

import { env } from 'env';
import 'i18n';
import { bootstrapOSRDConf } from 'reducers/osrdconf';
import { getInfraID } from 'reducers/osrdconf/selectors';
import { attemptLoginOnLaunch } from 'reducers/user';

import HomeCarto from 'applications/carto/Home';
import HomeCustomGET from 'applications/customget/Home';
import HomeEditor from 'applications/editor/Home';
import HomeOpenData from 'applications/opendata/Home';
import HomeOSRD from 'applications/osrd/Home';
import HomeStdcm from 'applications/stdcm/Home';
import Loader from 'common/Loader';
import history from 'main/history';
import { ModalProvider, ModalSNCF } from 'common/BootstrapSNCF/ModalSNCF/ModalProvider';
import Home from 'main/Home';

export default function App() {
  const user = useSelector((state) => state.user);
  const infraID = useSelector(getInfraID);

  const { darkmode } = useSelector((state) => state.main);
  const dispatch = useDispatch();

  useEffect(() => {
    if (env.REACT_APP_LOCAL_BACKEND === 'true') {
      console.info('*** USING LOCAL BACKEND ***');
    } else {
      console.info('*** USING OSRD.DEV BACKEND ***');
      dispatch(attemptLoginOnLaunch());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Conditionnal theming
  useEffect(() => {
    if (darkmode) {
      import('@sncf/bootstrap-sncf.metier.reseau/dist/css/bootstrap-sncf.dark.min.css');
    } else {
      import('@sncf/bootstrap-sncf.metier.reseau/dist/css/bootstrap-sncf.min.css');
    }
  }, [darkmode]);

  // Loading initial data
  useEffect(() => {
    dispatch(bootstrapOSRDConf(infraID));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <Suspense fallback={<Loader />}>
      {(user.isLogged || env.REACT_APP_LOCAL_BACKEND) && (
        <ModalProvider>
          <ModalSNCF/>
          <HistoryRouter history={history}>
            <Routes>
              <Route path="/osrd/*" element={<HomeOSRD />} />
              <Route path="/carto/*" element={<HomeCarto />} />
              <Route path="/editor/*" element={<HomeEditor />} />
              <Route path="/stdcm/*" element={<HomeStdcm />} />
              <Route path="/opendata/*" element={<HomeOpenData />} />
              <Route path="/customget/*" element={<HomeCustomGET />} />
              <Route path="/*" element={<Home />} />
            </Routes>
          </HistoryRouter>
        </ModalProvider>
      )}
      {!user.isLogged && !env.REACT_APP_LOCAL_BACKEND && <Loader />}
    </Suspense>
  );
}
