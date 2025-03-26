import { useMemo } from 'react';

import { ChevronDown, ChevronUp } from '@osrd-project/ui-icons';
import cx from 'classnames';
import { useTranslation } from 'react-i18next';

import type { Conflict } from 'common/api/osrdEditoastApi';
import type { TimetableItemWithDetails } from 'modules/trainschedule/components/Timetable/types';

import ConflictCard from './ConflictCard';
import type { ConflictWithTrainNames } from '../types';
import addTrainNamesToConflicts from '../utils';

type ConflictsListProps = {
  conflicts: Conflict[];
  expanded: boolean;
  timetableItems: TimetableItemWithDetails[];
  toggleConflictsList: () => void;
  onConflictClick: (conflict: ConflictWithTrainNames) => void;
};

const ConflictsList = ({
  conflicts,
  expanded,
  timetableItems,
  toggleConflictsList,
  onConflictClick,
}: ConflictsListProps) => {
  const { t } = useTranslation(['operationalStudies/scenario']);
  const enrichedConflicts = useMemo(
    () => addTrainNamesToConflicts(conflicts, timetableItems),
    [conflicts, timetableItems]
  );
  if (conflicts.length === 0) {
    return null;
  }
  return (
    <div className={cx('conflicts-list', expanded && 'expanded')}>
      <div
        className="conflicts-list-header"
        role="button"
        tabIndex={0}
        onClick={toggleConflictsList}
      >
        <h2>
          {t('conflictsCount', {
            count: conflicts.length,
          })}
        </h2>
        {expanded ? <ChevronUp /> : <ChevronDown />}
      </div>

      <div className={cx('conflicts-container', expanded && 'expanded')}>
        {enrichedConflicts.map((conflict, index) => (
          <ConflictCard key={index} conflict={conflict} onConflictClick={onConflictClick} />
        ))}
      </div>
    </div>
  );
};

export default ConflictsList;
