import { Allowance } from 'common/api/osrdEditoastApi';
import React from 'react';
import cx from 'classnames';
import { useTranslation } from 'react-i18next';
import getAllowanceValue from './helpers';
import { unitsLabels } from './consts';
import {
  EngineeringAllowanceForm,
  RangeAllowanceForm,
  SetAllowanceSelectedIndexType,
} from './types';

type Props = {
  allowances: RangeAllowanceForm[] | EngineeringAllowanceForm[];
  allowanceSelectedIndex?: number;
  setAllowanceSelectedIndex: SetAllowanceSelectedIndexType;
  pathLength: number;
  globalDistribution?: Allowance['distribution'];
};

export default function AllowancesLinearView({
  allowances,
  allowanceSelectedIndex,
  setAllowanceSelectedIndex,
  pathLength,
  globalDistribution,
}: Props) {
  const { t } = useTranslation('operationalStudies/allowances');
  function valueToPercent(value: number) {
    return (100 * value) / pathLength;
  }
  function coloredDistribution(
    specific: RangeAllowanceForm | EngineeringAllowanceForm,
    global?: Allowance['distribution']
  ) {
    if (global) return globalDistribution;
    if (specific && 'distribution' in specific) return specific.distribution;
    return '';
  }
  return (
    <div className="outside-container">
      <div className="allowances-linear-view">
        {allowances && allowances.length > 0 ? (
          allowances.map((allowance, idx) => (
            <div
              className={cx('range', allowanceSelectedIndex === idx && 'selected')}
              style={{
                width: `${valueToPercent(allowance.end_position - allowance.begin_position)}%`,
                left: `${valueToPercent(allowance.begin_position)}%`,
              }}
              role="button"
              tabIndex={0}
              onClick={() => setAllowanceSelectedIndex(idx)}
              key={`linearview-${typeof allowance}-${idx}`}
            >
              <div className={`value ${coloredDistribution(allowance, globalDistribution)}`}>
                {getAllowanceValue(allowance.value)}
                <div className="unit">{unitsLabels[allowance.value.value_type]}</div>
              </div>
            </div>
          ))
        ) : (
          <div className="range-no-allowance">{t('no-allowance')}</div>
        )}
      </div>
    </div>
  );
}
