import React, { Suspense, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Route, Routes, unstable_HistoryRouter as HistoryRouter } from 'react-router-dom';

import 'i18n';
import { bootstrapOSRDConf } from 'reducers/osrdconf';
import { getInfraID } from 'reducers/osrdconf/selectors';
import { attemptLoginOnLaunch } from 'reducers/user';

import HomeCustomGET from 'applications/customget/Home';
import HomeEditor from 'applications/editor/Home';
import HomeMap from 'applications/referenceMap/Home';
import HomeOpenData from 'applications/opendata/Home';
import HomeOperationalStudies from 'applications/operationalStudies/Home';
import HomeStdcm from 'applications/stdcm/Home';
import { ModalProvider, ModalSNCF } from 'common/BootstrapSNCF/ModalSNCF/ModalProvider';
import Loader from 'common/Loader';
import history from 'main/history';
import Home from 'main/home';
import { NotificationsState } from 'common/Notifications';
import Project from 'applications/operationalStudies/views/Project';
import Study from 'applications/operationalStudies/views/Study';
import Scenario from 'applications/operationalStudies/views/Scenario';

export default function App() {
  const user = useSelector((state) => state.user);
  const infraID = useSelector(getInfraID);

  const { darkmode } = useSelector((state) => state.main);
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
      {(user.isLogged || isLocalBackend) && (
        <HistoryRouter history={history}>
          <ModalProvider>
            <ModalSNCF />
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
              <Route path="/stdcm/*" element={<HomeStdcm />} />
              <Route path="/opendata/*" element={<HomeOpenData />} />
              <Route path="/customget/*" element={<HomeCustomGET />} />
              <Route path="/*" element={<Home />} />
            </Routes>
          </ModalProvider>
        </HistoryRouter>
      )}
      {!user.isLogged && !isLocalBackend && <Loader />}
    </Suspense>
  );
}
