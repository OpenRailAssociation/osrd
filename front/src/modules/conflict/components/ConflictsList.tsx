import { useMemo } from 'react';

import cx from 'classnames';
import { useTranslation } from 'react-i18next';

import type { Conflict } from 'common/api/osrdEditoastApi';
import type { TimetableItemWithDetails } from 'modules/trainschedule/components/Timetable/types';

import ConflictCard from './ConflictCard';
import type { ConflictWithTrainNames } from '../types';
import addTrainNamesToConflicts from '../utils';

type ConflictsListProps = {
  conflicts: Conflict[];
  timetableItems: TimetableItemWithDetails[];
  onConflictClick: (conflict: ConflictWithTrainNames) => void;
};

const ConflictsList = ({ conflicts, timetableItems, onConflictClick }: ConflictsListProps) => {
  const { t } = useTranslation('operational-studies', { keyPrefix: 'main' });
  const enrichedConflicts = useMemo(
    () => addTrainNamesToConflicts(conflicts, timetableItems),
    [conflicts, timetableItems]
  );
  if (conflicts.length === 0) {
    return null;
  }
  return (
    <div className={cx('conflicts-list')}>
      <div className="conflicts-list-header" role="button" tabIndex={0}>
        <h2>
          {t('conflictsCount', {
            count: conflicts.length,
          })}
        </h2>
      </div>

      <div className={cx('conflicts-container')}>
        {enrichedConflicts.map((conflict, index) => (
          <ConflictCard key={index} conflict={conflict} onConflictClick={onConflictClick} />
        ))}
      </div>
    </div>
  );
};

export default ConflictsList;
