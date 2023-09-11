import React from 'react';
import { TbArrowRightBar } from 'react-icons/tb';
import { useTranslation } from 'react-i18next';
import { EngineeringAllowance, RangeAllowance } from 'common/api/osrdEditoastApi';
import cx from 'classnames';
import { AllowancesTypes, SetAllowanceSelectedIndexType } from './types';
import { unitsLabels } from './consts';
import getAllowanceValue from './helpers';

type AllowanceItemProps = {
  allowance: RangeAllowance | EngineeringAllowance;
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
  return 'begin_position' in allowance ? (
    <button
      className={cx('allowance', isSelected && 'selected', isOverlapped && 'overlapped')}
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
        <span className="end">{allowance.end_position}m</span>
      </div>
      <div className="length">{allowance.end_position - allowance.begin_position}m</div>
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
  ) : null;
}
