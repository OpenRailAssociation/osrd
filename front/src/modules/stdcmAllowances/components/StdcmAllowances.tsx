import React from 'react';
import { useDispatch, useSelector } from 'react-redux';

import { useTranslation } from 'react-i18next';

import InputSNCF from 'common/BootstrapSNCF/InputSNCF';
import InputGroupSNCF, { InputGroupSNCFValue } from 'common/BootstrapSNCF/InputGroupSNCF';

import {
  getGridMarginBefore,
  getGridMarginAfter,
  getStandardStdcmAllowance,
} from 'reducers/osrdconf/selectors';
import {
  updateGridMarginAfter,
  updateGridMarginBefore,
  updateStdcmStandardAllowance,
} from 'reducers/osrdconf';
import { StandardAllowance } from 'applications/operationalStudies/consts';
import { AllowanceValue } from 'common/api/osrdEditoastApi';
import { convertInputStringToNumber } from 'utils/strings';
import { ALLOWANCE_UNITS_KEYS } from 'applications/stdcm/components/allowancesConsts';

const StdcmAllowances = () => {
  const { t } = useTranslation('allowances');
  const dispatch = useDispatch();
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
        newTypeValue.value === '' || newTypeValue.value === undefined ? 0 : +newTypeValue.value,
    };

    dispatch(updateStdcmStandardAllowance(processedType));
  };

  return (
    <div className="d-flex mb-2 osrd-config-item-container">
      <div className="col-3">
        <InputSNCF
          id="standardAllowanceTypeGridMarginBefore"
          type="number"
          value={gridMarginBefore || ''}
          unit={ALLOWANCE_UNITS_KEYS.time}
          onChange={(e) =>
            dispatch(updateGridMarginBefore(convertInputStringToNumber(e.target.value)))
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
            dispatch(updateGridMarginAfter(convertInputStringToNumber(e.target.value)))
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
