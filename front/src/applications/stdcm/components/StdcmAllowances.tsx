import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import { MarginType } from 'applications/stdcm/types';
import InputGroupSNCF from 'common/BootstrapSNCF/InputGroupSNCF';
import type { InputGroupSNCFValue } from 'common/BootstrapSNCF/InputGroupSNCF';
import InputSNCF from 'common/BootstrapSNCF/InputSNCF';
import {
  updateGridMarginAfter,
  updateGridMarginBefore,
  updateStandardAllowance,
} from 'reducers/osrdconf/stdcmConf';
import { getMargins } from 'reducers/osrdconf/stdcmConf/selectors';
import { useAppDispatch } from 'store';
import { Duration } from 'utils/duration';
import { convertInputStringToNumber } from 'utils/strings';

const STANDARD_MARGIN_UNITS = [
  {
    id: 'percentage',
    label: '%',
  },
  {
    id: 'time_per_distance',
    label: 'min/100km',
  },
];

const StdcmAllowances = ({ disabled = false }: { disabled?: boolean }) => {
  const { t } = useTranslation('stdcm');
  const dispatch = useAppDispatch();
  const { gridMarginAfter, gridMarginBefore, standardAllowance } = useSelector(getMargins);

  const onChangeType = (newTypeValue: InputGroupSNCFValue<MarginType>) => {
    const processedType =
      newTypeValue.value !== undefined
        ? {
            type: newTypeValue.unit,
            value: Math.abs(newTypeValue.value),
          }
        : undefined;

    dispatch(updateStandardAllowance(processedType));
  };

  return (
    <div className="d-flex mb-2 osrd-config-item-container px-0">
      <div className="d-flex flex-column">
        <span className="ml-1">{t('allowances.gridMarginBeforeAfter')}</span>
        <div className="d-flex">
          <div className="col-6">
            <InputSNCF
              id="standardAllowanceTypeGridMarginBefore"
              type="number"
              value={gridMarginBefore?.total('second') || ''}
              unit="s"
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
              unit="s"
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
        <label htmlFor="standardAllowanceTypeSelect">{t('allowances.standardAllowance')}</label>
        <InputGroupSNCF
          id="standardAllowanceTypeSelect"
          options={STANDARD_MARGIN_UNITS}
          onChange={onChangeType}
          currentValue={{
            unit: standardAllowance?.type || MarginType.PERCENTAGE,
            value: standardAllowance?.value,
          }}
          disabled={disabled}
        />
      </div>
    </div>
  );
};

export default StdcmAllowances;
