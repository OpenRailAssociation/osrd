import React, { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import InputGroupSNCF, { InputGroupSNCFValue } from 'common/BootstrapSNCF/InputGroupSNCF';
import OptionsSNCF from 'common/BootstrapSNCF/OptionsSNCF';
import { onlyDigit } from 'utils/strings';
import { unitsList, unitsNames } from './consts';
import getAllowanceValue from './helpers';
import { AllowanceValueForm, StandardAllowanceForm } from './types';

type Props = {
  distribution: string;
  setDistribution: (distribution: StandardAllowanceForm['distribution']) => void;
  valueAndUnit: AllowanceValueForm;
  setValueAndUnit: (valueAndUnit: AllowanceValueForm) => void;
};

export default function AllowancesStandardSettings({
  distribution,
  setDistribution,
  valueAndUnit,
  setValueAndUnit,
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

  const handleType = (type: InputGroupSNCFValue) => {
    if (type.type && type.value !== undefined) {
      setValueAndUnit({
        value_type: type.type as AllowanceValueForm['value_type'],
        [unitsNames[type.type as keyof typeof unitsNames]]:
          onlyDigit(type.value as string) !== '' ? +onlyDigit(type.value as string) : undefined,
      } as AllowanceValueForm);
    }
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
            orientation="right"
            sm
            condensed
            value={allowanceValue !== undefined ? allowanceValue : ''}
            type={valueAndUnit.value_type}
            handleType={handleType}
            options={unitsList}
            typeValue="number"
            min={1}
            isInvalid={allowanceValue !== undefined && allowanceValue < 1}
            textRight
          />
        </div>
      </div>
    </div>
  );
}
