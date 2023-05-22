import React from 'react';
import StdcmSingleAllowance from 'applications/operationalStudies/components/SimulationResults/Allowances/withOSRDStdcmParams';
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
              <StdcmSingleAllowance typeKey="gridMarginBefore" isStdcm />
            </div>
            <div className="col-6">
              <StdcmSingleAllowance typeKey="gridMarginAfter" isStdcm />
            </div>
          </div>
        </div>
        <div className="col-6">
          <div>{t('allowances:standardAllowance')}</div>
          <StdcmSingleAllowance typeKey="standardStdcmAllowance" isStdcm />
        </div>
      </div>
    </div>
  );
};

export default STDCMAllowances;
