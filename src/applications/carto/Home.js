import React from 'react';
import PropTypes from 'prop-types';
import { withTranslation } from 'react-i18next';
import { Route, Switch } from 'react-router-dom';
import config from 'config/config';
import NavBarSNCF from 'common/BootstrapSNCF/NavBarSNCF';
import logo from 'assets/logo_osrd_seul_blanc.svg';
import Map from './Map';

class HomeCartoLegacy extends React.Component {
  static propTypes = {
    t: PropTypes.func.isRequired,
  }

  render() {
    const { t } = this.props;
    return (
      <>
        <NavBarSNCF appName={t('Map.title')} logo={logo} />
        <div className="no-mastnav">
          <Switch>
            <Route exact path="/carto">
              <Map urlmap={config.proxy} />
            </Route>
            <Route path="/carto/:urlLat/:urlLon/:urlZoom/:urlBearing/:urlPitch">
              <Map urlmap={config.proxy} />
            </Route>
          </Switch>
        </div>
      </>
    );
  }
}

const HomeCarto = withTranslation()(HomeCartoLegacy);

export default HomeCarto;
