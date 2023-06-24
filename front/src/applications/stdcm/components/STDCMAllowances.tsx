import React from 'react';
import StdcmSingleAllowance from 'applications/stdcm/components/OldAllowances/withOSRDStdcmParams';
import { useTranslation } from 'react-i18next';

const STDCMAllowances = () => {
  const { t } = useTranslation('allowances');

  return (
    <div className="osrd-config-item mb-2 osrd-config-item-container">
      <div className="row">
        <div className="col-6">
          <div>{t('allowances:gridMarginBeforeAfter')}</div>
          <div className="row">
            <div className="col-6">
              <StdcmSingleAllowance typeKey="gridMarginBefore" isCondensed />
            </div>
            <div className="col-6">
              <StdcmSingleAllowance typeKey="gridMarginAfter" isCondensed />
            </div>
          </div>
        </div>
        <div className="col-6">
          <div>{t('allowances:standardAllowance')}</div>
          <StdcmSingleAllowance typeKey="standardStdcmAllowance" isCondensed />
        </div>
      </div>
    </div>
  );
};

export default STDCMAllowances;
