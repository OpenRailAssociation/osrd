import React, { Suspense, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Route, Routes, unstable_HistoryRouter as HistoryRouter } from 'react-router-dom';
import 'i18n';
import { updateLastInterfaceVersion } from 'reducers/main';

import HomeEditor from 'applications/editor/Home';
import HomeMap from 'applications/referenceMap/Home';
import HomeOperationalStudies from 'applications/operationalStudies/Home';
import HomeStdcm from 'applications/stdcm/Home';
import { ModalProvider } from 'common/BootstrapSNCF/ModalSNCF/ModalProvider';
import Loader from 'common/Loader';
import history from 'main/history';
import Home from 'main/home';
import { NotificationsState } from 'common/Notifications';
import Project from 'applications/operationalStudies/views/Project';
import Study from 'applications/operationalStudies/views/Study';
import Scenario from 'applications/operationalStudies/views/Scenario';
import HomeRollingStockEditor from 'applications/rollingStockEditor/Home';
import { getIsUserLogged } from 'applications/common/reducer/user/userSelectors';
import { attemptLoginOnLaunch } from 'applications/common/reducer/user/userSlice';

import('@sncf/bootstrap-sncf.metier.reseau/dist/css/bootstrap-sncf.min.css');
export default function App() {
  const isUserLogged = useSelector(getIsUserLogged);

  const dispatch = useDispatch();
  const isLocalBackend = import.meta.env.OSRD_LOCAL_BACKEND.trim().toLowerCase() === 'true';

  useEffect(() => {
    if (isLocalBackend) {
      console.info('*** USING LOCAL BACKEND ***');
    } else {
      console.info('*** USING OSRD.DEV BACKEND ***');
      dispatch(attemptLoginOnLaunch());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    // Blindly dispatch current front version for storage
    dispatch(updateLastInterfaceVersion(import.meta.env.OSRD_GIT_DESCRIBE));
  }, []);

  return (
    <Suspense fallback={<Loader />}>
      {(isUserLogged || isLocalBackend) && (
        <HistoryRouter history={history}>
          <ModalProvider>
            <NotificationsState />
            <Routes>
              <Route path="/operational-studies">
                <Route path="/operational-studies" element={<HomeOperationalStudies />} />
                <Route path="/operational-studies/project" element={<Project />} />
                <Route path="/operational-studies/study" element={<Study />} />
                <Route path="/operational-studies/scenario" element={<Scenario />} />
              </Route>
              <Route path="/map/*" element={<HomeMap />} />
              <Route path="/editor/*" element={<HomeEditor />} />
              <Route path="/rolling-stock-editor/*" element={<HomeRollingStockEditor />} />
              <Route path="/stdcm/*" element={<HomeStdcm />} />
              <Route path="/*" element={<Home />} />
            </Routes>
          </ModalProvider>
        </HistoryRouter>
      )}
      {!isUserLogged && !isLocalBackend && <Loader />}
    </Suspense>
  );
}
