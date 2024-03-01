import React from 'react';
import { TbArrowRightBar } from 'react-icons/tb';
import { useTranslation } from 'react-i18next';
import cx from 'classnames';
import {
  AllowancesTypes,
  type EngineeringAllowanceForm,
  type RangeAllowanceForm,
  type SetAllowanceSelectedIndexType,
} from './types';
import { unitsLabels } from './consts';
import getAllowanceValue from './helpers';

type AllowanceItemProps = {
  allowance: RangeAllowanceForm | EngineeringAllowanceForm;
  idx: number;
  isSelected?: boolean;
  isOverlapped?: boolean;
  setAllowanceSelectedIndex: SetAllowanceSelectedIndexType;
};

export default function AllowancesListItem({
  allowance,
  idx,
  isSelected,
  isOverlapped,
  setAllowanceSelectedIndex,
}: AllowanceItemProps) {
  const { t } = useTranslation('operationalStudies/allowances');
  return (
    <button
      className={cx('allowance', { selected: isSelected, overlapped: isOverlapped })}
      type="button"
      onClick={() => setAllowanceSelectedIndex(idx)}
      data-testid="engineering-allowance"
    >
      <div className="positions">
        <span className="index">{idx + 1}</span>
        <span className="begin">{allowance.begin_position}</span>
        <span className="separator">
          <TbArrowRightBar />
        </span>
        <span className="end">{Math.round(allowance.end_position)}m</span>
      </div>
      <div className="length">{Math.round(allowance.end_position) - allowance.begin_position}m</div>
      {'allowance_type' in allowance &&
        allowance.allowance_type === AllowancesTypes.engineering && (
          <div className={`distribution ${allowance.distribution}`}>
            {t(`distribution.${allowance.distribution}`)}
          </div>
        )}
      <div className="value">
        {getAllowanceValue(allowance.value)}
        <span className="unit">{unitsLabels[allowance.value.value_type]}</span>
      </div>
    </button>
  );
}
