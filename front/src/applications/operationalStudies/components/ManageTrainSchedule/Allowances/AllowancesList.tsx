import React from 'react';
import { EngineeringAllowance, RangeAllowance } from 'common/api/osrdEditoastApi';
import { TbArrowRightBar } from 'react-icons/tb';
import { useTranslation } from 'react-i18next';
import cx from 'classnames';
import { SetAllowanceSelectedIndexType, AllowancesTypes } from './types';
import { unitsLabels } from './consts';
import getAllowanceValue from './Helpers';

type AllowanceItemProps = {
  allowance: RangeAllowance | EngineeringAllowance;
  idx: number;
  isSelected: boolean;
  setAllowanceSelectedIndex: SetAllowanceSelectedIndexType;
};

type AllowancesListProps = {
  allowances: RangeAllowance[] | EngineeringAllowance[];
  allowanceSelectedIndex?: number;
  type: AllowancesTypes;
  setAllowanceSelectedIndex: SetAllowanceSelectedIndexType;
};

const AllowanceItem = ({
  allowance,
  idx,
  isSelected = false,
  setAllowanceSelectedIndex,
}: AllowanceItemProps) => {
  const { t } = useTranslation('operationalStudies/allowances');
  return 'begin_position' in allowance ? (
    <button
      className={cx('allowance', isSelected && 'selected')}
      type="button"
      onClick={() => setAllowanceSelectedIndex(idx)}
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
      {'allowance_type' in allowance && allowance.allowance_type === 'engineering' && (
        <div className="distribution">{t(`distribution.${allowance.distribution}`)}</div>
      )}
      <div className="value">
        {getAllowanceValue(allowance.value)}
        <span className="unit">{unitsLabels[allowance.value.value_type]}</span>
      </div>
    </button>
  ) : null;
};

export default function AllowancesList({
  allowances,
  allowanceSelectedIndex,
  type,
  setAllowanceSelectedIndex,
}: AllowancesListProps) {
  if (type === AllowancesTypes.standard) {
    allowances.sort((a, b) => a.begin_position - b.begin_position);
    return (
      <div className="allowances-list mt-2">
        {allowances &&
          allowances.map((allowance: RangeAllowance, idx) => (
            <AllowanceItem
              allowance={allowance}
              idx={idx}
              isSelected={allowanceSelectedIndex === idx}
              setAllowanceSelectedIndex={setAllowanceSelectedIndex}
            />
          ))}
      </div>
    );
  }
  if (type === AllowancesTypes.engineering) {
    return (
      <div className="allowances-list mt-2">
        {allowances.map((allowance, idx) => (
          <AllowanceItem
            allowance={allowance}
            idx={idx}
            isSelected={allowanceSelectedIndex === idx}
            setAllowanceSelectedIndex={setAllowanceSelectedIndex}
          />
        ))}
      </div>
    );
  }
  return <>pas de marges</>;
}
