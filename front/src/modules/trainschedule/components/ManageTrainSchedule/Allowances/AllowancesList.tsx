import React, { useCallback } from 'react';

import AllowancesListItem from './AllowancesListItem';
import type {
  SetAllowanceSelectedIndexType,
  OverlapAllowancesIndexesType,
  RangeAllowanceForm,
  EngineeringAllowanceForm,
} from './types';

type AllowancesListProps = {
  allowances: RangeAllowanceForm[] | EngineeringAllowanceForm[];
  allowanceSelectedIndex?: number;
  setAllowanceSelectedIndex: SetAllowanceSelectedIndexType;
  overlapAllowancesIndexes?: OverlapAllowancesIndexesType;
};

export default function AllowancesList({
  allowances,
  allowanceSelectedIndex,
  setAllowanceSelectedIndex,
  overlapAllowancesIndexes,
}: AllowancesListProps) {
  // Test if index of allowance is part of overlapped allowances
  // It's an array with index of first and last allowance concerned
  // false if selected, -1 if no allowance founded
  //
  // Have to test if :
  const isOverlapped = useCallback(
    (index: number) => {
      if (!overlapAllowancesIndexes) return false;

      // if indexes are both -1 or false, return false
      if (
        overlapAllowancesIndexes.every(
          (overlapIndex) => overlapIndex === -1 || overlapIndex === false
        )
      )
        return false;

      const firstIndex =
        overlapAllowancesIndexes[0] !== false && overlapAllowancesIndexes[0] > -1
          ? overlapAllowancesIndexes[0]
          : 0;
      const lastIndex =
        overlapAllowancesIndexes[1] !== false && overlapAllowancesIndexes[1] > -1
          ? overlapAllowancesIndexes[1]
          : allowances.length - 1;

      // check if index is between overlapAllowancesIndexes
      return firstIndex <= index && index <= lastIndex;
    },
    [overlapAllowancesIndexes]
  );

  return (
    <div className="allowances-list">
      {allowances
        .map((allowance, idx) => ({
          ...allowance,
          isOverlapped: isOverlapped(idx),
          selectAllowance: () => setAllowanceSelectedIndex(idx),
          isSelected: allowanceSelectedIndex === idx,
        }))
        .filter((allowance) => !allowance.isDefault)
        .map((allowance, idx) =>
          !allowance.isDefault ? (
            <AllowancesListItem
              allowance={allowance}
              idx={idx}
              isSelected={allowance.isSelected}
              setAllowanceSelectedIndex={allowance.selectAllowance}
              isOverlapped={allowance.isOverlapped}
              key={`allowance-${idx}`}
            />
          ) : null
        )}
    </div>
  );
}
