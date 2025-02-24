import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import type { AllowanceValue } from 'applications/stdcm/types';
import InputGroupSNCF from 'common/BootstrapSNCF/InputGroupSNCF';
import type { InputGroupSNCFValue } from 'common/BootstrapSNCF/InputGroupSNCF';
import InputSNCF from 'common/BootstrapSNCF/InputSNCF';
import { ALLOWANCE_UNITS_KEYS } from 'modules/stdcmAllowances/allowancesConsts';
import {
  updateGridMarginAfter,
  updateGridMarginBefore,
  updateStandardAllowance,
} from 'reducers/osrdconf/stdcmConf';
import { getMargins } from 'reducers/osrdconf/stdcmConf/selectors';
import type { StandardAllowance } from 'reducers/osrdconf/types';
import { useAppDispatch } from 'store';
import { Duration } from 'utils/duration';
import { convertInputStringToNumber } from 'utils/strings';

const StdcmAllowances = ({ disabled = false }: { disabled?: boolean }) => {
  const { t } = useTranslation('allowances');
  const dispatch = useAppDispatch();
  const { gridMarginAfter, gridMarginBefore, standardAllowance } = useSelector(getMargins);
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

    dispatch(updateStandardAllowance(processedType));
  };

  return (
    <div className="d-flex mb-2 osrd-config-item-container px-0">
      <div className="d-flex flex-column">
        <span className="ml-1">{t('allowances:gridMarginBeforeAfter')}</span>
        <div className="d-flex">
          <div className="col-6">
            <InputSNCF
              id="standardAllowanceTypeGridMarginBefore"
              type="number"
              value={gridMarginBefore?.total('second') || ''}
              unit={ALLOWANCE_UNITS_KEYS.time}
              onChange={(e) =>
                dispatch(
                  updateGridMarginBefore(
                    new Duration({ seconds: Math.abs(convertInputStringToNumber(e.target.value)) })
                  )
                )
              }
              disabled={disabled}
              sm
              noMargin
              label=""
              textRight
            />
          </div>
          <div className="col-6">
            <InputSNCF
              id="standardAllowanceTypeGridMarginAfter"
              type="number"
              value={gridMarginAfter?.total('second') || ''}
              unit={ALLOWANCE_UNITS_KEYS.time}
              onChange={(e) =>
                dispatch(
                  updateGridMarginAfter(
                    new Duration({ seconds: Math.abs(convertInputStringToNumber(e.target.value)) })
                  )
                )
              }
              disabled={disabled}
              sm
              noMargin
              label=""
              textRight
            />
          </div>
        </div>
      </div>
      <div className="col-6">
        <label htmlFor="standardAllowanceTypeSelect">{t('allowances:standardAllowance')}</label>
        <InputGroupSNCF
          id="standardAllowanceTypeSelect"
          options={standardAllowanceTypes}
          onChange={onchangeType}
          currentValue={{
            unit: standardAllowance?.type || 'percentage',
            value: standardAllowance?.value,
          }}
          disabled={disabled}
        />
      </div>
    </div>
  );
};

export default StdcmAllowances;
