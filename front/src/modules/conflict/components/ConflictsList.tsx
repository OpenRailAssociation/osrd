import { useMemo } from 'react';

import cx from 'classnames';

import type { Conflict } from 'common/api/osrdEditoastApi';
import type { TimetableItemWithDetails } from 'modules/timetableItem/types';

import ConflictCard from './ConflictCard';
import type { ConflictWithTrainNames } from '../types';
import addTrainNamesToConflicts from '../utils';

type ConflictsListProps = {
  conflicts: Conflict[];
  timetableItems: TimetableItemWithDetails[];
  onConflictClick: (conflict: ConflictWithTrainNames) => void;
};

const ConflictsList = ({ conflicts, timetableItems, onConflictClick }: ConflictsListProps) => {
  const enrichedConflicts = useMemo(
    () => addTrainNamesToConflicts(conflicts, timetableItems),
    [conflicts, timetableItems]
  );
  if (conflicts.length === 0) {
    return null;
  }
  return (
    <div className={cx('conflicts-container')}>
      {enrichedConflicts.map((conflict, index) => (
        <ConflictCard key={index} conflict={conflict} onConflictClick={onConflictClick} />
      ))}
    </div>
  );
};

export default ConflictsList;
