import React from 'react';
import { EngineeringAllowance, RangeAllowance } from 'common/api/osrdEditoastApi';
import {
  SetAllowanceSelectedIndexType,
  AllowancesTypes,
  OverlapAllowancesIndexesType,
} from './types';
import AllowancesListItem from './AllowancesListItem';

type AllowancesListProps = {
  allowances: RangeAllowance[] | EngineeringAllowance[];
  allowanceSelectedIndex?: number;
  type: AllowancesTypes;
  setAllowanceSelectedIndex: SetAllowanceSelectedIndexType;
  overlapAllowancesIndexes?: OverlapAllowancesIndexesType;
};

export default function AllowancesList({
  allowances,
  allowanceSelectedIndex,
  type,
  setAllowanceSelectedIndex,
  overlapAllowancesIndexes,
}: AllowancesListProps) {
  const isOverlapped = (index: number) =>
    overlapAllowancesIndexes &&
    (index === overlapAllowancesIndexes[0] ||
      index === overlapAllowancesIndexes[1] ||
      (overlapAllowancesIndexes[0] !== false &&
        overlapAllowancesIndexes[1] !== false &&
        overlapAllowancesIndexes[0] > -1 &&
        overlapAllowancesIndexes[1] > -1 &&
        index > overlapAllowancesIndexes[0] &&
        index < overlapAllowancesIndexes[1]));

  if (type === AllowancesTypes.standard) {
    return (
      <div className="allowances-list mt-2">
        {allowances &&
          allowances.map((allowance: RangeAllowance, idx) => (
            <AllowancesListItem
              allowance={allowance}
              idx={idx}
              isSelected={allowanceSelectedIndex === idx}
              setAllowanceSelectedIndex={setAllowanceSelectedIndex}
              isOverlapped={isOverlapped(idx)}
              key={`allowance-${type}-${idx}`}
            />
          ))}
      </div>
    );
  }
  if (type === AllowancesTypes.engineering) {
    return (
      <div className="allowances-list mt-2">
        {allowances &&
          allowances.map((allowance, idx) => (
            <AllowancesListItem
              allowance={allowance}
              idx={idx}
              isSelected={allowanceSelectedIndex === idx}
              setAllowanceSelectedIndex={setAllowanceSelectedIndex}
              key={`allowance-${type}-${idx}`}
            />
          ))}
      </div>
    );
  }
  return <>pas de marges</>;
}
