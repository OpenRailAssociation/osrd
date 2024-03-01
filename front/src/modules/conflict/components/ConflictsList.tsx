import React from 'react';
import cx from 'classnames';
import { BsLightningFill } from 'react-icons/bs';
import { useTranslation } from 'react-i18next';
import { sec2time } from 'utils/timeManipulation';
import type { Conflict } from 'common/api/osrdEditoastApi';

type ConflictTableProps = {
  conflicts: Conflict[];
  expanded: boolean;
  toggleConflictsList: () => void;
  onClick: (conflict: Conflict) => void;
};

function ConflictCard({ conflict, onClick }: { conflict: Conflict; onClick: () => void }) {
  const { t } = useTranslation(['operationalStudies/scenario']);

  return (
    <div className="conflict-card" onClick={onClick} role="button" tabIndex={0}>
      <BsLightningFill color="red" />
      <div className="conflict-trains">
        {conflict.train_names.map((train_name, index) => (
          <div className="card-text" key={`train-${index}-${train_name}`}>
            {train_name}
          </div>
        ))}
      </div>
      <div className="conflict-type">
        <p>{t(`${conflict.conflict_type}`)}</p>
      </div>
      <div className="conflict-times">
        <div className="start-time">{sec2time(conflict.start_time)}</div>
        <div className="end-time">{sec2time(conflict.end_time)}</div>
      </div>
    </div>
  );
}

export default function ConflictsList({
  conflicts,
  expanded,
  toggleConflictsList,
  onClick,
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
            onClick={() => onClick(conflict)}
          />
        ))}
      </div>
    </div>
  );
}
