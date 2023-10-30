import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  SetAllowanceSelectedIndexType,
  AllowancesTypes,
  OverlapAllowancesIndexesType,
  RangeAllowanceForm,
  EngineeringAllowanceForm,
} from './types';
import AllowancesListItem from './AllowancesListItem';

type AllowancesListProps = {
  allowances: RangeAllowanceForm[] | EngineeringAllowanceForm[];
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
  const { t } = useTranslation('operationalStudies/allowances');

  // Test if index of allowance is part of overlapped allowances
  // It's an array with index of first and last allowance concerned
  // false if selected, -1 if no allowance founded
  //
  // Have to test if :
  const isOverlapped = (index: number) =>
    overlapAllowancesIndexes &&
    // indexes ARE thoses concerned
    (index === overlapAllowancesIndexes[0] ||
      index === overlapAllowancesIndexes[1] ||
      // If [0] is not selected (not false)
      (overlapAllowancesIndexes[0] !== false &&
        // If [0] is a find one, so !== -1
        overlapAllowancesIndexes[0] > -1 &&
        // if [0] is concerned
        index > overlapAllowancesIndexes[0] &&
        overlapAllowancesIndexes[1] !== false &&
        overlapAllowancesIndexes[1] > -1 &&
        index < overlapAllowancesIndexes[1]));

  if (type === AllowancesTypes.standard) {
    return (
      <div className="allowances-list">
        {allowances &&
          allowances.map((allowance: RangeAllowanceForm, idx) => (
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
      <div className="allowances-list">
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
  return <>{t('no-allowance')}</>;
}
