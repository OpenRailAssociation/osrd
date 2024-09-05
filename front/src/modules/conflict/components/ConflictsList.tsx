import { useMemo } from 'react';

import cx from 'classnames';
import { useTranslation } from 'react-i18next';

import type { Conflict } from 'common/api/osrdEditoastApi';
import type { TrainScheduleWithDetails } from 'modules/trainschedule/components/Timetable/types';

import ConflictCard from './ConflictCard';
import type { ConflictWithTrainNames } from '../types';
import addTrainNamesToConflicts from '../utils';

type ConflictsListProps = {
  conflicts: Conflict[];
  expanded: boolean;
  trainSchedulesDetails: TrainScheduleWithDetails[];
  toggleConflictsList: () => void;
  onConflictClick: (conflict: ConflictWithTrainNames) => void;
};

const ConflictsList = ({
  conflicts,
  expanded,
  trainSchedulesDetails,
  toggleConflictsList,
  onConflictClick,
}: ConflictsListProps) => {
  const { t } = useTranslation(['operationalStudies/scenario']);
  const enrichedConflicts = useMemo(
    () => addTrainNamesToConflicts(conflicts, trainSchedulesDetails),
    [conflicts, trainSchedulesDetails]
  );
  if (conflicts.length === 0) {
    return null;
  }
  return (
    <div className="conflicts-list">
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
        <i className={cx('icons-arrow-up', expanded && 'expanded')} />
      </div>

      <div className={cx('conflicts-container', expanded && 'expanded')}>
        {enrichedConflicts.map((conflict, index) => (
          <ConflictCard
            key={`${conflict.train_ids.join(', ')}-${conflict.conflict_type}-${index}`}
            conflict={conflict}
            onConflictClick={onConflictClick}
          />
        ))}
      </div>
    </div>
  );
};

export default ConflictsList;
