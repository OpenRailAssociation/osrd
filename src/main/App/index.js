import React, { Suspense } from 'react';
import { Router, Route, Switch } from 'react-router-dom';
import { connect } from 'react-redux';
import { bindActionCreators } from 'redux';
import PropTypes from 'prop-types';

import Loader from 'common/Loader';
import HomeOSRD from 'applications/osrd/Home';
import HomeSmartFlows from 'applications/smartflows/Home';
import HomeCarto from 'applications/carto/Home';

import * as allUserActions from 'reducers/user';
import Home from 'main/Home';
import history from 'main/history';

class App extends React.Component {
  static propTypes = {
    userActions: PropTypes.object.isRequired,
    user: PropTypes.object.isRequired,
  }

  async componentDidMount() {
    const { userActions } = this.props;
    await userActions.attemptLoginOnLaunch();
  }

  render() {
    const { user } = this.props;

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
            </Switch>
          </Router>
        )}
        {!user.isLogged && (
          <Loader />
        )}
      </Suspense>
    );
  }
}

const mapStateToProps = (state) => ({
  user: state.user,
  map: state.map,
});

const mapDispatchToProps = (dispatch) => ({
  userActions: bindActionCreators(allUserActions, dispatch),
});

export default connect(mapStateToProps, mapDispatchToProps)(App);
