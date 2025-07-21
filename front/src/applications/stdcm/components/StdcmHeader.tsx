import { Bug, SignOut } from '@osrd-project/ui-icons';
import cx from 'classnames';
import { useTranslation } from 'react-i18next';

import useAuthz from 'common/authorization/hooks/useAuthz';
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
  onDebugModeToggle: React.Dispatch<React.SetStateAction<boolean>>;
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
            onClick={() => onDebugModeToggle(!isDebugMode)}
          >
            <Bug />
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
