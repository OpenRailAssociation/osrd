import React, { forwardRef } from 'react';

import { Button } from '@osrd-project/ui-core';
import { useTranslation } from 'react-i18next';

import stdcmLoaderImg from 'assets/pictures/views/stdcm_v2_loader.jpg';

type StdcmLoaderProps = {
  cancelStdcmRequest: () => void;
};

const StdcmLoader = forwardRef(
  ({ cancelStdcmRequest }: StdcmLoaderProps, ref: React.Ref<HTMLDivElement>) => {
    const { t } = useTranslation('stdcm');
    return (
      <div
        ref={ref}
        className="stdcm-v2-loader d-flex flex-column justify-content-center align-items-center"
      >
        <div className="stdcm-v2-loader__wrapper">
          <h1>{t('simulation.calculatingSimulation')}</h1>
          <p>{t('simulation.averageRequestTime')}</p>
        </div>
        <div className="stdcm-v2-loader__cancel-btn">
          <Button
            variant="Cancel"
            label={t('simulation.stopCalculation')}
            size="small"
            onClick={cancelStdcmRequest}
          />
        </div>
        <img src={stdcmLoaderImg} alt={t('simulation.pendingSimulation')} />
        <p className="stdcm-v2-loader__img-signature">{t('loaderImageLegend')}</p>
      </div>
    );
  }
);

export default StdcmLoader;
