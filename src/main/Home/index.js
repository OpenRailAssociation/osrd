import React from 'react';
import NavBarSNCF from 'common/BootstrapSNCF/NavBarSNCF';
import Card from 'common/BootstrapSNCF/CardSNCF/CardSNCF';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import sncfReseauLogo from '@sncf/bootstrap-sncf.metier/dist/assets/img/brand/sncf-reseau-logo.png';
import dgexSolLogo from 'assets/pictures/dgexsollogo.png';
import osrdLogo from 'assets/pictures/osrd.png';
import smartflowsPic from 'assets/pictures/smartflows.png';
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
        <NavBarSNCF appName="DGEX Solutions" username={user.username} logo={sncfReseauLogo} />
        <main className="mastcontainer mastcontainer-no-mastnav">
          <h1 className="text-center">
            <img src={dgexSolLogo} alt="DGEX Solutions logo" />
          </h1>
          <div className="cardscontainer">
            <div className="row">
              <div className="col-sm-6 col-md-3 col-lg-2 mb-2">
                <Card img={osrdLogo} title="OSRD" link="/osrd" />
              </div>
              <div className="col-sm-6 col-md-3 col-lg-2 mb-2">
                <Card img={smartflowsPic} title="Affluence TR" link="/smartflows" />
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
