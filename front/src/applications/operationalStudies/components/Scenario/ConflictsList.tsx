import React from 'react';
import cx from 'classnames';
import { BsLightningFill } from 'react-icons/bs';
import { useTranslation } from 'react-i18next';
import { sec2time } from 'utils/timeManipulation';

export type Conflict = {
  train_ids: number[];
  conflict_type: string;
  start_time: string;
  end_time: string;
  train_names: string[];
};

type ConflictTableProps = {
  conflicts: Conflict[];
  expanded: boolean;
  toggleConflictsList: () => void;
};

function ConflictCard({ conflict }: { conflict: Conflict }) {
  const { t } = useTranslation(['operationalStudies/scenario']);

  return (
    <div className="conflict-card">
      <BsLightningFill color="red" />
      <div className="conflict-trains">
        <div className="card-text">{conflict.train_names[0]}</div>
        <div className="card-text">{conflict.train_names[1]}</div>
      </div>
      <div className="conflict-type">
        <p className="card-text">{t(`${conflict.conflict_type}`)}</p>
      </div>
      <div className="conflict-times">
        <div className="card-text start-time">{sec2time(Number(conflict.start_time))}</div>
        <div className="card-text end-time">{sec2time(Number(conflict.end_time))}</div>
      </div>
    </div>
  );
}

export default function ConflictsList({
  conflicts,
  expanded,
  toggleConflictsList,
}: ConflictTableProps) {
  const { t } = useTranslation(['operationalStudies/scenario']);

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
        {conflicts.map((conflict, index) => (
          <ConflictCard
            key={`${conflict.train_ids.join(', ')}-${conflict.conflict_type}-${index}`}
            conflict={conflict}
          />
        ))}
      </div>
    </div>
  );
}
