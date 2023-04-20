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
      className={`scenario-explorator-modal-part-itemslist-minicard project with-image ${
        isSelected ? 'selected' : ''
      } ${project.studies_count && project.studies_count > 0 ? '' : 'empty'}`}
      role="button"
      tabIndex={0}
      onClick={() =>
        !isSelected &&
        project.studies_count &&
        project.studies_count > 0 &&
        setSelectedID(project.id)
      }
    >
      <div className="scenario-explorator-modal-part-itemslist-minicard-img">
        <Project2Image project={project} />
      </div>
      <div>{project.name}</div>
    </div>
  );
}
