import { useTranslation } from 'react-i18next';

const StdcmHeader = () => {
  const { t } = useTranslation('stdcm');

  return (
    <div className="stdcm-v2-header d-flex">
      <span className="stdcm-v2-header__title pl-5">ST DCM</span>
      <div className="flex-grow-1 d-flex justify-content-center">
        <span className="stdcm-v2-header__notification " id="notification">
          {t('notificationTitle')}
        </span>
      </div>
    </div>
  );
};

export default StdcmHeader;
