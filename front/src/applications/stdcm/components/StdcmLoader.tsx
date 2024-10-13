import { forwardRef } from 'react';

import { Button } from '@osrd-project/ui-core';
import { useTranslation } from 'react-i18next';

import stdcmLoaderImg from 'assets/pictures/views/stdcm_loader.jpg';

type StdcmLoaderProps = {
  cancelStdcmRequest: () => void;
};

const StdcmLoader = forwardRef(
  ({ cancelStdcmRequest }: StdcmLoaderProps, ref: React.Ref<HTMLDivElement>) => {
    const { t } = useTranslation('stdcm');
    return (
      <div className="stdcm-loader-background">
        <div
          ref={ref}
          className="stdcm-loader d-flex flex-column justify-content-center align-items-center"
        >
          <div className="stdcm-loader__wrapper">
            <h1>{t('simulation.calculatingSimulation')}</h1>
            <p>{t('simulation.averageRequestTime')}</p>
          </div>
          <div className="stdcm-loader__cancel-btn">
            <Button
              variant="Cancel"
              label={t('simulation.stopCalculation')}
              size="small"
              onClick={cancelStdcmRequest}
            />
          </div>
          <img src={stdcmLoaderImg} alt={t('simulation.pendingSimulation')} />
          <p className="stdcm-loader__img-signature">{t('loaderImageLegend')}</p>
        </div>
      </div>
    );
  }
);

export default StdcmLoader;
