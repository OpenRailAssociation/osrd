import { Bug, SignOut } from '@osrd-project/ui-icons';
import { skipToken } from '@reduxjs/toolkit/query';
import cx from 'classnames';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import { osrdRailwayManagerApi } from 'common/api/osrdRailwayManagerApi';
import useAuthz from 'common/authorization/hooks/useAuthz';
import { setFailure } from 'reducers/main';
import { getRailwayManagerInterfaceUrl } from 'reducers/main/mainSelector';
import { useAppDispatch } from 'store';
import { castErrorToFailure } from 'utils/error';
import useAuth from 'utils/hooks/useAuth';
import useDeploymentSettings from 'utils/hooks/useDeploymentSettings';

const LogoSTDCM = () => {
  const deploymentSettings = useDeploymentSettings();

  if (deploymentSettings) {
    return deploymentSettings.stdcmLogo ? (
      <img src={deploymentSettings.stdcmLogo} alt="STDCM Logo" className="stdcm-header__logo" />
    ) : (
      <span className="stdcm-header__title pl-5">STDCM</span>
    );
  }
  return null;
};

type StdcmHeaderProps = {
  isDebugMode: boolean;
  onDebugModeToggle: () => void;
  toggleHelpModule: () => void;
  showHelpModule: boolean;
};

const StdcmHeader = ({
  isDebugMode,
  onDebugModeToggle,
  toggleHelpModule,
  showHelpModule,
}: StdcmHeaderProps) => {
  const { t } = useTranslation(['stdcm', 'translation']);
  const { isSuperUser } = useAuthz();
  const { impersonatedUser, impersonate } = useAuth();
  const dispatch = useAppDispatch();
  const railwayManagerUrl = useSelector(getRailwayManagerInterfaceUrl);

  const { data: sendLMRAuthorizedResponse } =
    osrdRailwayManagerApi.endpoints.getSendLastMinuteRequestAuthorized.useQuery(
      railwayManagerUrl ? undefined : skipToken
    );

  const requestsFolderUrl =
    osrdRailwayManagerApi.endpoints.getSendLastMinuteRequestFolderUrl.useQuery();

  const openRequestsFolder = async () => {
    try {
      window.open(requestsFolderUrl.data!.url, '_blank', 'noopener,noreferrer');
    } catch (err) {
      dispatch(
        setFailure(
          castErrorToFailure(err, {
            name: t('translation:common.error'),
            message: t('header.errorRequestsFolder'),
          })
        )
      );
    }
  };

  return (
    <div className={cx('stdcm-header', impersonatedUser ? 'stdcm-header__impersonated' : 'd-flex')}>
      <LogoSTDCM />
      <div className="flex-grow-1 d-flex justify-content-center" />
      <div className="stdcm-header__debug">
        {isSuperUser && (
          <button
            data-testid="stdcm-debug-button"
            type="button"
            aria-label="stdcm-debug"
            className={cx('debug', { selected: isDebugMode, 'impersonated-bg': impersonatedUser })}
            onClick={() => onDebugModeToggle()}
          >
            <Bug />
          </button>
        )}
        {railwayManagerUrl &&
          sendLMRAuthorizedResponse?.authorized &&
          requestsFolderUrl.isSuccess && (
            <button
              data-testid="stdcm-requests-folder-button"
              type="button"
              aria-label={t('header.requests')}
              className={cx('ml-4 px-3', {
                'impersonated-bg': impersonatedUser,
              })}
              onClick={openRequestsFolder}
            >
              {t('header.requests')}
            </button>
          )}
        <button
          data-testid="stdcm-help-button"
          type="button"
          aria-label="stdcm-help"
          className={cx('ml-4 px-3', {
            selected: showHelpModule,
            'impersonated-bg': impersonatedUser,
          })}
          onClick={() => toggleHelpModule()}
        >
          {t('translation:common.help')}
        </button>
        {impersonatedUser && (
          <button
            type="button"
            aria-label="stdcm-impersonated"
            className="impersonated ml-4"
            onClick={() => impersonate(undefined)}
          >
            <SignOut />
          </button>
        )}
      </div>
    </div>
  );
};

export default StdcmHeader;
