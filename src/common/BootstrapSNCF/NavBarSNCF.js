import React from 'react';
import { Link } from 'react-router-dom';
import { FaPowerOff } from 'react-icons/fa';
import i18n from 'i18next';
import { withTranslation } from 'react-i18next';
import PropTypes from 'prop-types';
import { bindActionCreators } from 'redux';
import { connect } from 'react-redux';
import frenchFlag from '@sncf/bootstrap-sncf.metier/dist/assets/img/flags/french.svg';
import englishFlag from '@sncf/bootstrap-sncf.metier/dist/assets/img/flags/english.svg';
import * as allUserActions from '../../reducers/user';
import DropdownSNCF, { DROPDOWN_STYLE_TYPES } from './DropdownSNCF';

class LegacyNavBarSNCF extends React.Component {
  static propTypes = {
    userActions: PropTypes.object.isRequired,
    user: PropTypes.object.isRequired,
    main: PropTypes.object.isRequired,
    appName: PropTypes.string.isRequired,
    t: PropTypes.func.isRequired,
    logo: PropTypes.string.isRequired,
  }

  toLogout = () => {
    const { userActions } = this.props;
    userActions.logout();
  }

  changeLanguage = (lng) => {
    i18n.changeLanguage(lng);
  }

  render() {
    const {
      t, appName, logo, user, main,
    } = this.props;

    return (
      <div className={`mastheader${main.fullscreen ? ' fullscreen' : ''}`}>
        <div className="mastheader-logo">
          <Link to="/">
            <img alt={appName} src={logo} width="70" />
          </Link>
        </div>
        <header role="banner" className="mastheader-title d-none d-xl-block">
          <h1 className="text-uppercase text-white pt-2 pl-3 mb-0">{appName}</h1>
        </header>
        <ul className="mastheader-toolbar toolbar mb-0">
          {/* <li className="toolbar-item toolbar-item-spacing">
            <button type="button" className="btn btn-transparent px-0 mr-2" onClick={() => this.changeLanguage('fr')}>
              <img src={frenchFlag} alt={t('Login.frenchFlag')} />
            </button>
            <button type="button" className="btn btn-transparent px-0" onClick={() => this.changeLanguage('en')}>
              <img src={englishFlag} alt={t('Login.englishFlag')} />
            </button>
          </li> */}
          <li className="toolbar-item separator-gray-500">
            <DropdownSNCF
              titleContent={(
                <>
                  <i className="icons-menu-account icons-size-1x25 icons-md-size-1x5 mr-xl-2" aria-hidden="true" />
                  <span className="d-none d-xl-block">
                    {user.account.firstName}
                    {' '}
                    {user.account.lastName}
                  </span>
                </>
              )}
              type={DROPDOWN_STYLE_TYPES.transparent}
              items={[
                <button
                  type="button"
                  className="btn-link text-reset"
                  onClick={this.toLogout}
                  key="logout"
                >
                  <span className="mr-2"><FaPowerOff /></span>
                  {t('NavBar.disconnect')}
                </button>,
              ]}
            />
          </li>
        </ul>
      </div>
    );
  }
}
const NavBarSNCF = withTranslation()(LegacyNavBarSNCF);

const mapStateToProps = (state) => ({
  user: state.user,
  main: state.main,
});

const mapDispatchToProps = (dispatch) => ({
  userActions: bindActionCreators(allUserActions, dispatch),
});

export default connect(mapStateToProps, mapDispatchToProps)(NavBarSNCF);
