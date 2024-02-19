import React from 'react';
import { useSelector } from 'react-redux';
import { useTranslation } from 'react-i18next';

import { convertInputStringToNumber } from 'utils/strings';

import { ALLOWANCE_UNITS_KEYS } from 'modules/stdcmAllowances/allowancesConsts';

import InputSNCF from 'common/BootstrapSNCF/InputSNCF';
import InputGroupSNCF from 'common/BootstrapSNCF/InputGroupSNCF';
import type { AllowanceValue } from 'common/api/osrdEditoastApi';
import { useOsrdConfActions, useOsrdConfSelectors } from 'common/osrdContext';
import type { InputGroupSNCFValue } from 'common/BootstrapSNCF/InputGroupSNCF';

import { useAppDispatch } from 'store';
import type { StdcmConfSliceActions } from 'reducers/osrdconf/stdcmConf';
import type { StdcmConfSelectors } from 'reducers/osrdconf/stdcmConf/selectors';
import type { StandardAllowance } from 'reducers/osrdconf/consts';

const StdcmAllowances = () => {
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

  const onchangeType = (newTypeValue: InputGroupSNCFValue) => {
    if (newTypeValue.type == null) return;
    const processedType: StandardAllowance = {
      type: newTypeValue.type as AllowanceValue['value_type'],
      value:
        newTypeValue.value === '' || newTypeValue.value === undefined
          ? 0
          : Math.abs(+newTypeValue.value),
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
          handleType={onchangeType}
          value={stdcmStandardAllowance?.value || ''}
          type={stdcmStandardAllowance?.type || 'percentage'}
          orientation="right"
          typeValue="number"
          condensed
          sm
          textRight
        />
      </div>
    </div>
  );
};

export default StdcmAllowances;
