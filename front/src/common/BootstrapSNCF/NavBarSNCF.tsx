import { useMemo, type ReactElement } from 'react';

import { Hubot, Person, ShieldCheck, XCircle } from '@osrd-project/ui-icons';
import cx from 'classnames';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';
import { Link } from 'react-router-dom';

import { addTagTypes, osrdEditoastApi } from 'common/api/osrdEditoastApi';
import UserActionsDropdown from 'common/UserActionsDropdown';
import UserSettings from 'common/UserSettings';
import { setImpersonatedUser } from 'reducers/user';
import { getUserSafeWord } from 'reducers/user/userSelectors';
import { useAppDispatch } from 'store';
import useAuth from 'utils/hooks/useAuth';
import useDeploymentSettings from 'utils/hooks/useDeploymentSettings';

import { useModal } from './ModalSNCF';

type Props = {
  appName?: string | ReactElement;
};

const LegacyNavBarSNCF = ({ appName }: Props) => {
  const { openModal } = useModal();
  const dispatch = useAppDispatch();
  const deploymentSettings = useDeploymentSettings();
  const safeWord = useSelector(getUserSafeWord);
  const { t } = useTranslation();

  const { username, impersonatedUser } = useAuth();
  const tagsToInvalidate = addTagTypes.map((tag) => ({ type: tag }));

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
    <div className={cx({ 'impersonated-user': impersonatedUser })}>
      {impersonatedUser ? (
        <Hubot size="lg" className="mr-xl-2" />
      ) : (
        <Person variant="fill" size="lg" className="mr-xl-2" />
      )}
      <span>{username}</span>
    </div>
  );

  return (
    <div className={cx('mastheader', impersonatedUser ? 'mastheader-impersonated' : 'mastheader')}>
      <div
        className={cx(
          'flex-grow-0',
          deploymentSettings?.hasCustomizedLogo ? 'mastheader-logo-with-name' : 'mastheader-logo',
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
          <UserActionsDropdown titleContent={userDropdownTitle} />
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
