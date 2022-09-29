import 'applications/osrd/osrd.scss';

import { Route, Routes } from 'react-router-dom';
import { connect } from 'react-redux';

import MastNavItemSNCF from 'common/BootstrapSNCF/MastNavItemSNCF';
import MastNavSNCF from 'common/BootstrapSNCF/MastNavSNCF';
import NavBarSNCF from 'common/BootstrapSNCF/NavBarSNCF';
import { NotificationsState } from 'common/Notifications.tsx';
import PropTypes from 'prop-types';
import React from 'react';
import logo from 'assets/logo_osrd_seul_blanc.svg';
import { withTranslation } from 'react-i18next';

import CustomGET from 'applications/customget/views/CustomGET';

class HomeCustomGET extends React.Component {
  static propTypes = {
    t: PropTypes.func.isRequired,
    osrdsimulation: PropTypes.object.isRequired,
  };

  render() {
    const { t, osrdsimulation } = this.props;
    return (
      <>
        <MastNavSNCF
          items={
            <MastNavItemSNCF
              link="/customget/"
              linkname={t('osrd.nav.home')}
              icon="icons-itinerary-train-station"
            />
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
          <Route path="" element={<CustomGET />} />
        </Routes>
        <NotificationsState />
      </>
    );
  }
}

const mapStateToProps = (state) => ({
  osrdsimulation: state.osrdsimulation,
});

export default connect(mapStateToProps)(withTranslation()(HomeCustomGET));
