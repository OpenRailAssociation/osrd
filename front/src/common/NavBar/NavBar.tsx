import { useMemo, type ReactElement } from 'react';

import { Hubot, Person, ShieldCheck, XCircle } from '@osrd-project/ui-icons';
import cx from 'classnames';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';
import { Link } from 'react-router-dom';

import { useModal } from 'common/BootstrapSNCF/ModalSNCF';
import { getUserSafeWord } from 'reducers/user/userSelectors';
import useAuth from 'utils/hooks/useAuth';
import useDeploymentSettings from 'utils/hooks/useDeploymentSettings';

import UserActionsDropdown from './UserActionsDropdown';
import UserSettings from './UserSettings';

type NavBarProps = {
  appName?: string | ReactElement;
};

const NavBar = ({ appName }: NavBarProps) => {
  const { openModal } = useModal();
  const deploymentSettings = useDeploymentSettings();
  const safeWord = useSelector(getUserSafeWord);
  const { t } = useTranslation();

  const { username, impersonatedUser, impersonate } = useAuth();

  const { logoUrl, name } = useMemo(() => {
    if (!deploymentSettings)
      return {
        logoUrl: undefined,
        name: 'Osrd',
      };
    return {
      logoUrl: deploymentSettings.operationalStudiesLogoWithName,
      name: deploymentSettings.operationalStudiesName,
    };
  }, [deploymentSettings]);

  const userDropdownTitle = (
    <div className={cx('user-dropdown', { 'impersonated-user': impersonatedUser })}>
      {impersonatedUser ? (
        <Hubot size="lg" className="mr-2" />
      ) : (
        <Person size="sm" className="mr-2" />
      )}
      <span>{username}</span>
    </div>
  );

  return (
    <div className={cx('nav-bar', { impersonated: impersonatedUser })}>
      <div
        className={cx('app-logo', {
          'custom-logo': deploymentSettings?.hasCustomizedLogo,
          'without-image': logoUrl,
        })}
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
      <header role="banner" className="d-flex flex-grow-1">
        <h1 className="text-white pl-3 mb-0">{appName}</h1>
      </header>
      <ul className="right-tool-bar">
        {safeWord && (
          <li className="item">
            <button
              type="button"
              className="safe-word-btn"
              onClick={() => openModal(<UserSettings />)}
              aria-label={t('nav-bar.userSettings')}
              title={t('nav-bar.userSettings')}
            >
              <ShieldCheck />
            </button>
          </li>
        )}
        <li className={cx('item', { 'with-separator': !!safeWord })}>
          <UserActionsDropdown titleContent={userDropdownTitle} />
          {impersonatedUser && (
            <button
              className="impersonated-user"
              type="button"
              onClick={() => impersonate(undefined)}
            >
              <XCircle variant="fill" />
            </button>
          )}
        </li>
      </ul>
    </div>
  );
};

export default NavBar;
