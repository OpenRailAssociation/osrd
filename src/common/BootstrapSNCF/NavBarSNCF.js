import React from 'react';
import { Link } from 'react-router-dom';
import i18n from 'i18next';
import { useTranslation } from 'react-i18next';
import PropTypes from 'prop-types';
import { useDispatch, useSelector } from 'react-redux';
import frenchFlag from '@sncf/bootstrap-sncf.metier.reseau/dist/assets/img/flags/french.svg';
import englishFlag from '@sncf/bootstrap-sncf.metier.reseau/dist/assets/img/flags/english.svg';
import { FaPowerOff, FaMoon, FaSun } from 'react-icons/fa';
import { logout } from 'reducers/user';
import { toggleDarkmode } from 'reducers/main.ts';
import SwitchSNCF from 'common/BootstrapSNCF/SwitchSNCF/SwitchSNCF';
import DropdownSNCF, { DROPDOWN_STYLE_TYPES } from './DropdownSNCF';

export default function LegacyNavBarSNCF(props) {
  const user = useSelector((state) => state.user);
  const { fullscreen, darkmode } = useSelector((state) => state.main);
  const {
    appName, logo,
  } = props;
  const dispatch = useDispatch();
  const { t } = useTranslation();

  const toLogout = () => {
    dispatch(logout());
  };

  const changeLanguage = (lng) => {
    i18n.changeLanguage(lng);
  };

  const changeDarkmode = () => {
    dispatch(toggleDarkmode());
    window.location.reload(false);
  };

  return (
    <div className={`mastheader${fullscreen ? ' fullscreen' : ''}`}>
      <div className="mastheader-logo">
        <Link to="/">
          <img alt={appName} src={logo} width="70" />
        </Link>
      </div>
      <header role="banner" className="mastheader-title d-none d-xl-block">
        <h1 className="text-uppercase text-white pt-2 pl-3 mb-0">{appName}</h1>
      </header>
      <ul className="mastheader-toolbar toolbar mb-0">
        <li className="toolbar-item toolbar-item-spacing">
          <div className="d-flex align-items-center h-100 text-white">
            <span className="mr-2 text-yellow"><FaSun /></span>
            <SwitchSNCF
              type="switch"
              onChange={changeDarkmode}
              name="darkmode-switch"
              id="darkmode-switch"
              checked={darkmode}
            />
            <span className="ml-2 text-black"><FaMoon /></span>
          </div>
        </li>
        <li className="toolbar-item toolbar-item-spacing separator-gray-500">
          <button type="button" className="btn btn-transparent px-0 mr-2" onClick={() => changeLanguage('fr')}>
            <img src={frenchFlag} alt={t('Login.frenchFlag')} />
          </button>
          <button type="button" className="btn btn-transparent px-0" onClick={() => changeLanguage('en')}>
            <img src={englishFlag} alt={t('Login.englishFlag')} />
          </button>
        </li>
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
                onClick={toLogout}
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

LegacyNavBarSNCF.propTypes = {
  appName: PropTypes.string.isRequired,
  logo: PropTypes.string.isRequired,
};
