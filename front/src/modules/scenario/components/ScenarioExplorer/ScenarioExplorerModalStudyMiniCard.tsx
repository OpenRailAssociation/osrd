import cx from 'classnames';
import React from 'react';
import { MiniCardsStudyProps } from './ScenarioExplorerTypes';

export default function StudyMiniCard({ study, setSelectedID, isSelected }: MiniCardsStudyProps) {
  return (
    <div
      className={cx('minicard', 'study', {
        selected: isSelected,
        empty: study.scenarios_count === 0,
      })}
      role="button"
      tabIndex={0}
      onClick={() => setSelectedID(study.id)}
    >
      <div>{study.name}</div>
    </div>
  );
}
