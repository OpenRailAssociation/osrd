import React, { useMemo } from 'react';

import { useTranslation } from 'react-i18next';

import InputGroupSNCF, { type InputGroupSNCFValue } from 'common/BootstrapSNCF/InputGroupSNCF';
import OptionsSNCF from 'common/BootstrapSNCF/OptionsSNCF';

import { unitsList, unitsNames } from './consts';
import getAllowanceValue from './helpers';
import type { AllowanceValueForm, StandardAllowanceForm } from './types';

type Props = {
  distribution: string;
  setDistribution: (distribution: StandardAllowanceForm['distribution']) => void;
  valueAndUnit: AllowanceValueForm;
  updateStandardAllowanceDefaultValue: (valueAndUnit: AllowanceValueForm) => void;
};

export default function AllowancesStandardSettings({
  distribution,
  setDistribution,
  valueAndUnit,
  updateStandardAllowanceDefaultValue,
}: Props) {
  const { t } = useTranslation(['operationalStudies/allowances', 'translation']);

  const allowanceValue = useMemo(() => getAllowanceValue(valueAndUnit), [valueAndUnit]);

  const distributionsList = useMemo(
    () => [
      {
        label: (
          <>
            <span className="bullet-linear">●</span>
            {t('operationalStudies/allowances:distribution.linear')}
          </>
        ),
        value: 'LINEAR',
      },
      {
        label: (
          <>
            <span className="bullet-mareco">●</span>
            {t('operationalStudies/allowances:distribution.mareco')}
          </>
        ),
        value: 'MARECO',
      },
    ],
    [t]
  );

  const handleType = <U extends string>(type: InputGroupSNCFValue<U>) => {
    updateStandardAllowanceDefaultValue({
      value_type: type.unit as AllowanceValueForm['value_type'],
      [unitsNames[type.unit as keyof typeof unitsNames]]:
        type.value !== undefined ? type.value : undefined,
    } as AllowanceValueForm);
  };

  return (
    <div className="allowances-actions">
      <div className="first-line">
        <div>
          <OptionsSNCF
            name="allowances-standard-distribution-switch"
            onChange={(e) =>
              setDistribution(e.target.value as StandardAllowanceForm['distribution'])
            }
            selectedValue={distribution}
            options={distributionsList}
          />
        </div>
        <div className="allowances-value" data-testid="standard-allowance-group">
          <InputGroupSNCF
            id="allowances-standard-settings-value"
            currentValue={{ unit: valueAndUnit.value_type, value: allowanceValue }}
            onChange={handleType}
            options={unitsList}
            min={1}
            isInvalid={allowanceValue !== undefined && allowanceValue < 1}
            inputDataTestId="allowances-standard-settings-value-input"
          />
        </div>
      </div>
    </div>
  );
}
