import React, { Suspense, useEffect } from 'react';
import { Router, Route, Switch } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';

import Loader from 'common/Loader';
import HomeOSRD from 'applications/osrd/Home';
import HomeSmartFlows from 'applications/smartflows/Home';
import HomeCarto from 'applications/carto/Home';
import HomeEditor from 'applications/editor/Home';

import { attemptLoginOnLaunch } from 'reducers/user';
import Home from 'main/Home';
import history from 'main/history';

export default function App() {
  const user = useSelector((state) => state.user);
  const { darkmode } = useSelector((state) => state.main);
  const dispatch = useDispatch();

  useEffect(() => {
    dispatch(attemptLoginOnLaunch());
  }, []);

  // Conditionnal theming
  useEffect(() => {
    if (darkmode) {
      import('@sncf/bootstrap-sncf.metier.reseau/dist/css/bootstrap-sncf.dark.min.css');
    } else {
      import('@sncf/bootstrap-sncf.metier.reseau/dist/css/bootstrap-sncf.min.css');
    }
  }, [darkmode]);

  return (
    <Suspense fallback={<Loader />}>
      {user.isLogged && (
        <Router history={history}>
          <Switch>
            <Route exact path="/">
              <Home />
            </Route>
            <Route path="/osrd">
              <HomeOSRD />
            </Route>
            <Route path="/smartflows">
              <HomeSmartFlows />
            </Route>
            <Route path="/carto">
              <HomeCarto />
            </Route>
            <Route path="/editor">
              <HomeEditor />
            </Route>
          </Switch>
        </Router>
      )}
      {!user.isLogged && (
        <Loader />
      )}

    </Suspense>
  );
}
