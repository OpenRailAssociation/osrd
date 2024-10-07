import { Bug } from '@osrd-project/ui-icons';
import cx from 'classnames';
import { useTranslation } from 'react-i18next';

import RoleBasedContent from 'common/authorization/components/RoleBasedContent';

type StdcmHeaderProps = {
  isDebugMode: boolean;
  onDebugModeToggle: React.Dispatch<React.SetStateAction<boolean>>;
};

const StdcmHeader = ({ isDebugMode, onDebugModeToggle }: StdcmHeaderProps) => {
  const { t } = useTranslation('stdcm');

  return (
    <div className="stdcm-v2-header d-flex">
      <span className="stdcm-v2-header__title pl-5">ST DCM</span>
      <div className="flex-grow-1 d-flex justify-content-center">
        <span className="stdcm-v2-header__notification " id="notification">
          {t('notificationTitle')}
        </span>
      </div>
      <RoleBasedContent requiredRoles={['Superuser']}>
        <div className="stdcm-v2-header_debug">
          <button
            type="button"
            aria-label="stdcm-debug"
            className={cx({ 'debug-on': isDebugMode, 'debug-off': !isDebugMode })}
            onClick={() => onDebugModeToggle(!isDebugMode)}
          >
            <Bug />
          </button>
        </div>
      </RoleBasedContent>
    </div>
  );
};

export default StdcmHeader;
