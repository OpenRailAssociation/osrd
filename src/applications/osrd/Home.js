import React from 'react';
import PropTypes from 'prop-types';
import { withTranslation } from 'react-i18next';
import { connect } from 'react-redux';
import { Route, Switch, Redirect } from 'react-router-dom';
import MastNavSNCF from 'common/BootstrapSNCF/MastNavSNCF';
import MastNavItemSNCF from 'common/BootstrapSNCF/MastNavItemSNCF';
import NavBarSNCF from 'common/BootstrapSNCF/NavBarSNCF';
import logo from 'assets/logo_osrd_seul_blanc.svg';
import AboutOSRD from './About';
import OSRDSimulation from './views/OSRDSimulation/OSRDSimulation';
import OSRDConfig from './views/OSRDConfig/OSRDConfig';
import 'applications/osrd/osrd.css';

class HomeOSRD extends React.Component {
  static propTypes = {
    t: PropTypes.func.isRequired,
    osrdsimulation: PropTypes.object.isRequired,
  }

  render() {
    const { t, osrdsimulation } = this.props;
    return (
      <>
        <MastNavSNCF
          items={(
            <>
              <MastNavItemSNCF link="/osrd/settings" linkname={t('osrd.nav.home')} icon="icons-itinerary-train-station" />
              {osrdsimulation.simulation !== undefined
                ? <MastNavItemSNCF link="/osrd/simulation" linkname={t('osrd.nav.simulation')} icon="icons-itinerary-train" />
                : null}
            </>
          )}
          itemsBottom={
            <MastNavItemSNCF link="/osrd/contact" linkname={t('osrd.nav.contact')} icon="icons-support" bottom />
          }
        />
        <NavBarSNCF appName="OSRD" logo={logo} />
        <Switch>
          <Route path="/osrd/settings">
            <OSRDConfig />
          </Route>
          <Route path="/osrd/about">
            <AboutOSRD />
          </Route>
          <Route path="/osrd/simulation">
            <OSRDSimulation />
          </Route>
          <Redirect to={osrdsimulation.redirectToGraph ? '/osrd/simulation' : '/osrd/settings'} />
        </Switch>
      </>
    );
  }
}


const mapStateToProps = (state) => ({
  osrdsimulation: state.osrdsimulation,
});

export default connect(mapStateToProps)(withTranslation()(HomeOSRD));
