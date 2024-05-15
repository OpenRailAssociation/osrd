import React from 'react';

import { useTranslation } from 'react-i18next';

const StdcmHeader = () => {
  const { t } = useTranslation('stdcm');
  return (
    <div className="stdcm-v2-header">
      <span className="stdcm-v2-header__title">ST DCM</span>
      <span className="stdcm-v2-header__notification" id="notification">
        {t('notificationTitle')}
        {/* <a href="#notification">Plus d’informations</a> */}
      </span>
    </div>
  );
};

export default StdcmHeader;
