import React from 'react';
import { useTranslation } from 'react-i18next';
import InputGroupSNCF, { InputGroupSNCFValue } from 'common/BootstrapSNCF/InputGroupSNCF';
import OptionsSNCF from 'common/BootstrapSNCF/OptionsSNCF';
import { AllowanceValue, StandardAllowance } from 'common/api/osrdEditoastApi';
import { unitsList, unitsNames } from './consts';
import getAllowanceValue from './Helpers';

type Props = {
  distribution: string;
  setDistribution: (distribution: StandardAllowance['distribution']) => void;
  valueAndUnit: AllowanceValue;
  setValueAndUnit: (valueAndUnit: AllowanceValue) => void;
};

export default function AllowancesStandardSettings({
  distribution,
  setDistribution,
  valueAndUnit,
  setValueAndUnit,
}: Props) {
  const { t } = useTranslation('operationalStudies/allowances');
  const distributionsList = [
    { label: t('distribution.linear'), value: 'LINEAR' },
    { label: t('distribution.mareco'), value: 'MARECO' },
  ];

  const handleType = (type: InputGroupSNCFValue) => {
    if (type.type && type.value !== undefined) {
      setValueAndUnit({
        value_type: type.type as AllowanceValue['value_type'],
        [unitsNames[type.type as keyof typeof unitsNames]]: type.value,
      } as AllowanceValue);
    }
  };

  return (
    <div className="allowances-actions">
      <div className="first-line">
        <div>
          <OptionsSNCF
            name="allowances-standard-distribution-switch"
            onChange={(e) => setDistribution(e.target.value as StandardAllowance['distribution'])}
            selectedValue={distribution}
            options={distributionsList}
          />
        </div>
        <div className="allowances-value">
          <InputGroupSNCF
            id="allowances-standard-settings-value"
            orientation="right"
            sm
            condensed
            value={getAllowanceValue(valueAndUnit)}
            handleType={handleType}
            options={unitsList}
            typeValue="number"
            min={0}
            isInvalid={getAllowanceValue(valueAndUnit) < 0}
          />
        </div>
      </div>
    </div>
  );
}
