import { FaMoon, FaPowerOff, FaSun } from 'react-icons/fa';
import { useDispatch, useSelector } from 'react-redux';

import { Link } from 'react-router-dom';
import PropTypes from 'prop-types';
import React from 'react';
import SwitchSNCF from 'common/BootstrapSNCF/SwitchSNCF/SwitchSNCF';
// import englishFlag from '@sncf/bootstrap-sncf.metier.reseau/dist/assets/img/flags/english.svg';
// import frenchFlag from '@sncf/bootstrap-sncf.metier.reseau/dist/assets/img/flags/french.svg';
// import i18n from 'i18next';
import { logout } from 'reducers/user';
import { toggleDarkmode } from 'reducers/main';
import { useTranslation } from 'react-i18next';
import DropdownSNCF, { DROPDOWN_STYLE_TYPES } from './DropdownSNCF';

export default function LegacyNavBarSNCF(props) {
  const user = useSelector((state) => state.user);
  const { fullscreen, darkmode } = useSelector((state) => state.main);
  const { appName, logo } = props;
  const dispatch = useDispatch();
  const { t } = useTranslation();

  const toLogout = () => {
    dispatch(logout());
  };

  /*
  const changeLanguage = (lng) => {
    i18n.changeLanguage(lng);
  };

  const changeDarkmode = () => {
    dispatch(toggleDarkmode());
    window.location.reload(false);
  };
  */

  return (
    <div className={`mastheader${fullscreen ? ' fullscreen' : ''}`}>
      <div className="mastheader-logo flex-grow-0">
        <Link to="/">
          <img alt={appName} src={logo} width="70" />
        </Link>
      </div>
      <header role="banner" className="mastheader-title d-flex flex-grow-1">
        <h1 className="text-white pl-3 mb-0">{appName}</h1>
      </header>
      <ul className="mastheader-toolbar toolbar mb-0">
        {/* <li className="toolbar-item toolbar-item-spacing">
          <div className="d-flex align-items-center h-100 text-white">
            <span className="mr-2 text-yellow">
              <FaSun />
            </span>
            <SwitchSNCF
              type="switch"
              onChange={changeDarkmode}
              name="darkmode-switch"
              id="darkmode-switch"
              checked={darkmode}
            />
            <span className="ml-2 text-black">
              <FaMoon />
            </span>
          </div>
        </li>
        <li className="toolbar-item toolbar-item-spacing separator-gray-500">
          <button
            type="button"
            className="btn btn-transparent px-0 mr-2"
            onClick={() => changeLanguage('fr')}
          >
            <img src={frenchFlag} alt={t('Login.frenchFlag')} />
          </button>
          <button
            type="button"
            className="btn btn-transparent px-0"
            onClick={() => changeLanguage('en')}
          >
            <img src={englishFlag} alt={t('Login.englishFlag')} />
          </button>
        </li> */}

        <li className="toolbar-item separator-gray-500">
          <DropdownSNCF
            titleContent={
              <>
                <i
                  className="icons-menu-account icons-size-1x25 icons-md-size-1x5 mr-xl-2"
                  aria-hidden="true"
                />
                <span className="d-none d-xl-block">
                  {user.account.firstName} {user.account.lastName}
                </span>
              </>
            }
            type={DROPDOWN_STYLE_TYPES.transparent}
            items={[
              <button type="button" className="btn-link text-reset" onClick={toLogout} key="logout">
                <span className="mr-2">
                  <FaPowerOff />
                </span>
                {t('NavBar.disconnect')}
              </button>,
            ]}
          />
        </li>
      </ul>
    </div>
  );
}

LegacyNavBarSNCF.propTypes = {
  appName: PropTypes.oneOfType([PropTypes.string, PropTypes.object]).isRequired,
  logo: PropTypes.string.isRequired,
};
