import { useMemo, type ReactElement } from 'react';

import {
  Gear,
  Hubot,
  Info,
  Person,
  Report,
  ShieldCheck,
  SignOut,
  XCircle,
} from '@osrd-project/ui-icons';
import cx from 'classnames';
import getUnicodeFlagIcon from 'country-flag-icons/unicode';
import i18n from 'i18next';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';
import { Link } from 'react-router-dom';

import { addTagTypes, osrdEditoastApi } from 'common/api/osrdEditoastApi';
import ChangeLanguageModal from 'common/ChangeLanguageModal';
import ReleaseInformations from 'common/ReleaseInformations';
import UserSettings from 'common/UserSettings';
import { setImpersonatedUser } from 'reducers/user';
import { getUserSafeWord } from 'reducers/user/userSelectors';
import { useAppDispatch } from 'store';
import useAuth from 'utils/hooks/useAuth';
import useDeploymentSettings from 'utils/hooks/useDeploymentSettings';
import { language2flag } from 'utils/strings';

import DropdownSNCF, { DROPDOWN_STYLE_TYPES } from './DropdownSNCF';
import HelpModalSNCF from './HelpModalSNCF';
import { useModal } from './ModalSNCF';

type Props = {
  appName?: string | ReactElement;
  showLogoWithName?: boolean;
};

const LegacyNavBarSNCF = ({ appName, showLogoWithName }: Props) => {
  const { openModal } = useModal();
  const dispatch = useAppDispatch();
  const deploymentSettings = useDeploymentSettings();
  const safeWord = useSelector(getUserSafeWord);
  const { t } = useTranslation();

  const { logout, username, impersonatedUser } = useAuth();
  const tagsToInvalidate = addTagTypes.map((tag) => ({ type: tag }));

  const { logoUrl, name } = useMemo(() => {
    if (!deploymentSettings)
      return {
        logoUrl: undefined,
        name: 'Osrd',
      };
    return {
      logoUrl: showLogoWithName
        ? deploymentSettings.operationalStudiesLogoWithName
        : deploymentSettings.operationalStudiesLogo,
      name: deploymentSettings.operationalStudiesName,
    };
  }, [deploymentSettings, showLogoWithName]);

  return (
    <div className={cx('mastheader', impersonatedUser ? 'mastheader-impersonated' : 'mastheader')}>
      <div
        className={cx(
          'flex-grow-0',
          deploymentSettings?.hasCustomizedLogo && showLogoWithName
            ? 'mastheader-logo-with-name'
            : 'mastheader-logo',
          { 'without-image': logoUrl }
        )}
      >
        <Link to="/">
          {logoUrl ? (
            <img
              src={logoUrl}
              data-testid={`${name.toLowerCase()}-logo`}
              alt={`${name.toUpperCase()} Logo`}
            />
          ) : (
            <div style={{ width: '24px' }} />
          )}
        </Link>
      </div>
      <header role="banner" className="mastheader-title d-flex flex-grow-1">
        <h1 className="text-white pl-3 mb-0">{appName}</h1>
      </header>
      <ul className="mastheader-toolbar toolbar mb-0">
        {safeWord && (
          <li className="toolbar-item separator-gray-500 d-none d-md-flex">
            <button
              type="button"
              className="btn btn-only-icon btn-link btn-notif toolbar-item-spacing text-success"
              onClick={() => openModal(<UserSettings />)}
              aria-label={t('nav-bar.userSettings')}
              title={t('nav-bar.userSettings')}
            >
              <ShieldCheck />
            </button>
          </li>
        )}
        <li className="toolbar-item separator-gray-500">
          <DropdownSNCF
            titleContent={
              <div className={cx(impersonatedUser ? 'impersonated-user' : 'd-none d-xl-block')}>
                {impersonatedUser ? (
                  <Hubot size="lg" className="mr-xl-2" />
                ) : (
                  <Person variant="fill" size="lg" className="mr-xl-2" />
                )}
                <span>{username}</span>
              </div>
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
                  <Info />
                </span>
                {t('nav-bar.about')}
              </button>,
              <button
                type="button"
                className="btn-link text-reset"
                onClick={() => openModal(<HelpModalSNCF />, 'lg')}
                key="help"
              >
                <span className="mr-2">
                  <Report />
                </span>
                {t('nav-bar.help')}
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
                <span data-testid="language-info">{t(`nav-bar.language.${i18n.language}`)} </span>
              </button>,
              <button
                data-testid="user-settings-btn"
                type="button"
                className="user-settings-btn btn-link text-reset"
                onClick={() => openModal(<UserSettings />)}
                key="release"
              >
                <span className="mr-2">
                  <Gear variant="fill" />
                </span>
                {t('nav-bar.userSettings')}
              </button>,
              <button type="button" className="btn-link text-reset" onClick={logout} key="logout">
                <span className="mr-2">
                  <SignOut />
                </span>
                {t('nav-bar.disconnect')}
              </button>,
            ]}
          />
          {impersonatedUser && (
            <button
              className="impersonated-user"
              type="button"
              onClick={() => {
                dispatch(setImpersonatedUser(undefined));
                dispatch(osrdEditoastApi.util.invalidateTags(tagsToInvalidate));
              }}
            >
              <XCircle variant="fill" />
            </button>
          )}
        </li>
      </ul>
    </div>
  );
};

export default LegacyNavBarSNCF;
