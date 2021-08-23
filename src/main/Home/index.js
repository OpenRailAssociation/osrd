import React from 'react';
import NavBarSNCF from 'common/BootstrapSNCF/NavBarSNCF';
import Card from 'common/BootstrapSNCF/CardSNCF/CardSNCF';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import sncfReseauLogo from '@sncf/bootstrap-sncf.metier/dist/assets/img/brand/sncf-reseau-logo.png';
// import dgexSolLogo from 'assets/pictures/dgexsollogo.png';
import osrdLogo from 'assets/pictures/osrd.png';
import logo from 'assets/logo_osrd_seul_blanc.svg';
import cartoPic from 'assets/pictures/carto.png';
import editorPic from 'assets/pictures/editor.png';
import './Home.css';

class Home extends React.Component {
  static propTypes = {
    user: PropTypes.object.isRequired,
  }

  render() {
    const { user } = this.props;

    return (
      <>
        <NavBarSNCF appName="OSRD" username={user.username} logo={sncfReseauLogo} />
        <main className="mastcontainer mastcontainer-no-mastnav">
          <div className="mt-3 d-flex align-items-center justify-content-center">
            <img src={osrdLogo} alt="OSRD logo" width="128px" />
            <h1>Open-Source Railway Designer</h1>
          </div>
          <div className="cardscontainer">
            <div className="row">
              <div className="col-sm-6 col-md-3 col-lg-2 mb-2">
                <Card img={osrdLogo} title="OSRD" link="/osrd" />
              </div>
              <div className="col-sm-6 col-md-3 col-lg-2 mb-2">
                <Card img={cartoPic} title="Cartographie" link="/carto" />
              </div>
              <div className="col-sm-6 col-md-3 col-lg-2 mb-2">
                <Card img={editorPic} title="Editor" link="/editor" />
              </div>
            </div>
          </div>
        </main>
      </>
    );
  }
}

const mapStateToProps = (state) => ({
  user: state.user,
});
export default connect(mapStateToProps)(Home);
