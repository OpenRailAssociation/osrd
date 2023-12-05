import React, { ReactElement } from 'react';
import { useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import { FaPowerOff, FaInfoCircle, FaCog } from 'react-icons/fa';
import { AiFillSafetyCertificate } from 'react-icons/ai';
import { useTranslation } from 'react-i18next';
import i18n from 'i18next';

import useAuth from 'utils/hooks/OsrdAuth';
import { getUserSafeWord } from 'reducers/user/userSelectors';
import ReleaseInformations from 'common/ReleaseInformations/ReleaseInformations';
import ChangeLanguageModal from 'common/ChangeLanguageModal';
import UserSettings from 'common/UserSettings';
import getUnicodeFlagIcon from 'country-flag-icons/unicode';
import { language2flag } from 'utils/strings';
import logoOSRD from 'assets/fav-osrd-color.svg';
import DropdownSNCF, { DROPDOWN_STYLE_TYPES } from './DropdownSNCF';
import { useModal } from './ModalSNCF';

type Props = {
  appName: string | ReactElement;
  logo?: string;
};

export default function LegacyNavBarSNCF({ appName, logo = logoOSRD }: Props) {
  const { openModal } = useModal();
  const safeWord = useSelector(getUserSafeWord);
  const { t } = useTranslation('home/navbar');
  const { logout, username } = useAuth();

  return (
    <div className="mastheader">
      <div className="mastheader-logo flex-grow-0">
        <Link to="/">
          <img src={logo} alt="OSRD Logo" />
        </Link>
      </div>
      <header role="banner" className="mastheader-title d-flex flex-grow-1">
        <h1 className="text-white pl-3 mb-0">{appName}</h1>
      </header>
      <ul className="mastheader-toolbar toolbar mb-0">
        {safeWord !== '' && (
          <li className="toolbar-item separator-gray-500 d-none d-md-flex">
            <button
              type="button"
              className="btn btn-only-icon btn-link btn-notif toolbar-item-spacing text-success"
              onClick={() => openModal(<UserSettings />)}
              title={t('safeWordActivated')}
            >
              <AiFillSafetyCertificate />
            </button>
          </li>
        )}
        <li className="toolbar-item separator-gray-500">
          <DropdownSNCF
            titleContent={
              <>
                <i
                  className="icons-menu-account icons-size-1x25 icons-md-size-1x5 mr-xl-2"
                  aria-hidden="true"
                />
                <span className="d-none d-xl-block">{username}</span>
              </>
            }
            type={DROPDOWN_STYLE_TYPES.transparent}
            items={[
              // Button to open modal displaying release version
              <button
                type="button"
                className="btn-link text-reset"
                onClick={() => openModal(<ReleaseInformations />, 'lg')}
                key="release"
              >
                <span className="mr-2">
                  <FaInfoCircle />
                </span>
                {t('about')}
              </button>,
              <button
                type="button"
                className="btn-link text-reset"
                onClick={() => openModal(<ChangeLanguageModal />, 'sm')}
                key="release"
              >
                <span className="mr-2">
                  {i18n.language && getUnicodeFlagIcon(language2flag(i18n.language))}
                </span>
                {t(`language.${i18n.language}`)}
              </button>,
              <button
                type="button"
                className="btn-link text-reset"
                onClick={() => openModal(<UserSettings />)}
                key="release"
              >
                <span className="mr-2">
                  <FaCog />
                </span>
                {t('userSettings')}
              </button>,
              <button type="button" className="btn-link text-reset" onClick={logout} key="logout">
                <span className="mr-2">
                  <FaPowerOff />
                </span>
                {t('disconnect')}
              </button>,
            ]}
          />
        </li>
      </ul>
    </div>
  );
}
