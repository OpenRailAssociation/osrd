import React from 'react';

import { Tools } from '@osrd-project/ui-icons';
import { useTranslation } from 'react-i18next';

import 'applications/stdcmV2/styles.scss';

const StdcmEmptyConfigError = () => {
  const { t } = useTranslation('stdcm');
  return (
    <div className="stdcm-config-error">
      <span className="mb-3 icon">
        <Tools size="lg" />
      </span>
      <h2 className="my-3 mx-0">{t('noConfigurationFound.title')}</h2>
      <p>{t('noConfigurationFound.text')}</p>
    </div>
  );
};

export default StdcmEmptyConfigError;
