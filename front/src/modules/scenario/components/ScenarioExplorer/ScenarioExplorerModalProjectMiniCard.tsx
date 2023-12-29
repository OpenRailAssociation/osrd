import cx from 'classnames';
import React from 'react';
import { MiniCardsProjectProps } from './ScenarioExplorerTypes';
import Project2Image from './ScenarioExplorerProject2Image';

export default function ProjectMiniCard({
  project,
  setSelectedID,
  isSelected,
}: MiniCardsProjectProps) {
  return (
    <div
      className={cx('minicard', 'project', 'with-image', {
        selected: isSelected,
        empty: project.studies_count === 0,
      })}
      role="button"
      tabIndex={0}
      onClick={() => {
        if (!isSelected && project.studies_count > 0) {
          setSelectedID(project.id);
        }
      }}
    >
      <div className="minicard-img">
        <Project2Image project={project} />
      </div>
      <div>{project.name}</div>
    </div>
  );
}
