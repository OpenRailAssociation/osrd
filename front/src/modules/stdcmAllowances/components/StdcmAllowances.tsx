import React from 'react';

import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import type { AllowanceValue } from 'common/api/osrdEditoastApi';
import InputGroupSNCF from 'common/BootstrapSNCF/InputGroupSNCF';
import type { InputGroupSNCFValue } from 'common/BootstrapSNCF/InputGroupSNCF';
import InputSNCF from 'common/BootstrapSNCF/InputSNCF';
import { useOsrdConfActions, useOsrdConfSelectors } from 'common/osrdContext';
import { ALLOWANCE_UNITS_KEYS } from 'modules/stdcmAllowances/allowancesConsts';
import type { StdcmConfSliceActions } from 'reducers/osrdconf/stdcmConf';
import type { StdcmConfSelectors } from 'reducers/osrdconf/stdcmConf/selectors';
import type { StandardAllowance } from 'reducers/osrdconf/types';
import { useAppDispatch } from 'store';
import { convertInputStringToNumber } from 'utils/strings';

const StdcmAllowances = ({ disabled = false }: { disabled?: boolean }) => {
  const { t } = useTranslation('allowances');
  const dispatch = useAppDispatch();
  const { getGridMarginBefore, getGridMarginAfter, getStandardStdcmAllowance } =
    useOsrdConfSelectors() as StdcmConfSelectors;
  const { updateGridMarginAfter, updateGridMarginBefore, updateStdcmStandardAllowance } =
    useOsrdConfActions() as StdcmConfSliceActions;
  const gridMarginBefore = useSelector(getGridMarginBefore);
  const gridMarginAfter = useSelector(getGridMarginAfter);
  const stdcmStandardAllowance = useSelector(getStandardStdcmAllowance);
  const standardAllowanceTypes = [
    {
      id: 'percentage',
      label: ALLOWANCE_UNITS_KEYS.percentage,
    },
    {
      id: 'time_per_distance',
      label: ALLOWANCE_UNITS_KEYS.time_per_distance,
    },
  ];

  const onchangeType = <U extends string>(newTypeValue: InputGroupSNCFValue<U>) => {
    const processedType: StandardAllowance = {
      type: newTypeValue.unit as AllowanceValue['value_type'],
      value: newTypeValue.value === undefined ? undefined : Math.abs(newTypeValue.value),
    };

    dispatch(updateStdcmStandardAllowance(processedType));
  };

  return (
    <div className="d-flex mb-2 osrd-config-item-container px-0">
      <div className="col-3">
        <InputSNCF
          id="standardAllowanceTypeGridMarginBefore"
          type="number"
          value={gridMarginBefore || ''}
          unit={ALLOWANCE_UNITS_KEYS.time}
          onChange={(e) =>
            dispatch(updateGridMarginBefore(Math.abs(convertInputStringToNumber(e.target.value))))
          }
          disabled={disabled}
          sm
          noMargin
          label={t('allowances:gridMarginBeforeAfter')}
          textRight
        />
      </div>
      <div className="col-3">
        <InputSNCF
          id="standardAllowanceTypeGridMarginAfter"
          type="number"
          value={gridMarginAfter || ''}
          unit={ALLOWANCE_UNITS_KEYS.time}
          onChange={(e) =>
            dispatch(updateGridMarginAfter(Math.abs(convertInputStringToNumber(e.target.value))))
          }
          disabled={disabled}
          sm
          noMargin
          label=" "
          textRight
        />
      </div>
      <div className="col-6">
        <label htmlFor="standardAllowanceTypeSelect">{t('allowances:standardAllowance')}</label>
        <InputGroupSNCF
          id="standardAllowanceTypeSelect"
          options={standardAllowanceTypes}
          onChange={onchangeType}
          currentValue={{
            unit: stdcmStandardAllowance?.type || 'percentage',
            value: stdcmStandardAllowance?.value,
          }}
          disabled={disabled}
        />
      </div>
    </div>
  );
};

export default StdcmAllowances;
