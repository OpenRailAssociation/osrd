import 'applications/osrd/osrd.scss';

import { Route, Routes } from 'react-router-dom';
import { connect } from 'react-redux';

import MastNavItemSNCF from 'common/BootstrapSNCF/MastNavItemSNCF';
import MastNavSNCF from 'common/BootstrapSNCF/MastNavSNCF';
import NavBarSNCF from 'common/BootstrapSNCF/NavBarSNCF';
import { Navigate } from 'react-router';
import { NotificationsState } from 'common/Notifications';
import PropTypes from 'prop-types';
import React from 'react';
import logo from 'assets/logo_osrd_seul_blanc.svg';
import { withTranslation } from 'react-i18next';
import OSRDSimulationConfig from './views/OSDSimulationConfig';
import OSRDSimulation from './views/OSRDSimulation/OSRDSimulation';
import AboutOSRD from './About';

class HomeOSRD extends React.Component {
  static propTypes = {
    t: PropTypes.func.isRequired,
    redirectToGraph: PropTypes.bool.isRequired,
  };

  static defaultProps = {
    redirectToGraph: false
  }

  render() {
    const { t, redirectToGraph } = this.props;
    return (
      <>
        <MastNavSNCF
          items={
            <>
              <MastNavItemSNCF
                link="/osrd/settings"
                linkname={t('osrd.nav.home')}
                icon="icons-itinerary-train-station"
              />
              <MastNavItemSNCF
                link="/osrd/simulation"
                linkname={t('osrd.nav.simulation')}
                icon="icons-itinerary-train"
              />
            </>
          }
          itemsBottom={
            <MastNavItemSNCF
              link="/osrd/contact"
              linkname={t('osrd.nav.contact')}
              icon="icons-support"
              bottom
            />
          }
        />
        <NavBarSNCF appName="OSRD" logo={logo} />
        <Routes>
          <Route path="/settings" element={<OSRDSimulationConfig />} />
          <Route path="/about" element={<AboutOSRD />} />
          <Route path="/simulation" element={<OSRDSimulation />} />

          <Route
            path=""
            element={
              <Navigate
                to={redirectToGraph ? '/osrd/simulation' : '/osrd/settings'}
                replace
              />
            }
          />
        </Routes>
        <NotificationsState />
      </>
    );
  }
}

const mapStateToProps = (state) => ({
  redirectToGraph: state.osrdsimulation.redirectToGraph,
});

export default connect(mapStateToProps)(withTranslation()(HomeOSRD));
