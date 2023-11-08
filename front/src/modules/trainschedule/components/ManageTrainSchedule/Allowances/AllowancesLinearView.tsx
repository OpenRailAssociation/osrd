import { Allowance } from 'common/api/osrdEditoastApi';
import React, { useMemo } from 'react';
import cx from 'classnames';
import { useTranslation } from 'react-i18next';

import { getAllowanceToDisplay, getAllowanceTag } from './helpers';
import {
  AllowanceValueForm,
  EngineeringAllowanceForm,
  RangeAllowanceForm,
  SetAllowanceSelectedIndexType,
} from './types';

type AllowanceTag = {
  allowance: { value: number | undefined; unit: string };
  width: number;
  leftOffset: number;
  distributionColor?: 'MARECO' | 'LINEAR';
};

type AllowanceTagProps = {
  allowance: { value: number | undefined; unit: string };
  isSelected: boolean;
  tagWidth: number;
  leftOffset: number;
  selectAllowance: () => void;
  distributionColor?: 'MARECO' | 'LINEAR';
};

const AllowanceTag = ({
  allowance,
  isSelected,
  tagWidth,
  leftOffset,
  selectAllowance,
  distributionColor,
}: AllowanceTagProps) => (
  <div
    className={cx('range', { selected: isSelected })}
    style={{
      width: `${tagWidth}%`,
      left: `${leftOffset}%`,
    }}
    role="button"
    tabIndex={0}
    onClick={selectAllowance}
  >
    <div className={`value ${distributionColor}`}>
      {allowance.value}
      <div className="unit">{allowance.unit}</div>
    </div>
  </div>
);

type AllowancesLinearViewProps = {
  allowances: RangeAllowanceForm[] | EngineeringAllowanceForm[];
  pathLength: number;
  setAllowanceSelectedIndex: SetAllowanceSelectedIndexType;
  allowanceSelectedIndex?: number;
  defaultAllowance?: AllowanceValueForm;
  globalDistribution?: Allowance['distribution'];
};

export default function AllowancesLinearView({
  allowances,
  setAllowanceSelectedIndex,
  pathLength,
  allowanceSelectedIndex,
  defaultAllowance,
  globalDistribution,
}: AllowancesLinearViewProps) {
  const { t } = useTranslation('operationalStudies/allowances');

  const defaultAllowanceToDisplay = useMemo(
    () => (defaultAllowance ? getAllowanceToDisplay(defaultAllowance) : undefined),
    [defaultAllowance]
  );

  const allowanceTags = useMemo(
    () => allowances.map((allowance) => getAllowanceTag(allowance, pathLength, globalDistribution)),
    [allowances, defaultAllowance, globalDistribution]
  );

  return (
    <div className="outside-container">
      <div className="allowances-linear-view">
        {allowances.length > 0 ? (
          allowanceTags.map((allowanceTag, idx) => (
            <AllowanceTag
              allowance={allowanceTag.allowance}
              isSelected={allowanceSelectedIndex === idx}
              tagWidth={allowanceTag.width}
              leftOffset={allowanceTag.leftOffset}
              distributionColor={allowanceTag.distributionColor}
              selectAllowance={() => setAllowanceSelectedIndex(idx)}
              key={`linearview-${idx}`}
            />
          ))
        ) : (
          <div className="range-no-allowance">
            {(defaultAllowanceToDisplay &&
              `${defaultAllowanceToDisplay.value}${defaultAllowanceToDisplay.unit}`) ||
              t('no-allowance')}
          </div>
        )}
      </div>
    </div>
  );
}
