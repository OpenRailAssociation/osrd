import { Bug, SignOut } from '@osrd-project/ui-icons';
import cx from 'classnames';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';
import { Link } from 'react-router-dom';

import { addTagTypes, osrdEditoastApi } from 'common/api/osrdEditoastApi';
import { setImpersonatedUser } from 'reducers/user';
import { getImpersonatedUser, getIsSuperUser } from 'reducers/user/userSelectors';
import { useAppDispatch } from 'store';
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
  const dispatch = useAppDispatch();
  const isSuperUser = useSelector(getIsSuperUser);
  const impersonatedUser = useSelector(getImpersonatedUser);
  const tagsToInvalidate = addTagTypes.map((tag) => ({ type: tag }));

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
          <Link to="/">
            <button
              type="button"
              aria-label="stdcm-impersonated"
              className="impersonated ml-4"
              onClick={() => {
                dispatch(setImpersonatedUser(undefined));
                dispatch(osrdEditoastApi.util.invalidateTags(tagsToInvalidate));
              }}
            >
              <SignOut />
            </button>
          </Link>
        )}
      </div>
    </div>
  );
};

export default StdcmHeader;
