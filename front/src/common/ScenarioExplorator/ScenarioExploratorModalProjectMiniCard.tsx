import React from 'react';
import { MiniCardsProjectProps } from './ScenarioExploratorTypes';
import Project2Image from './ScenarioExploratorProject2Image';

export default function ProjectMiniCard({
  project,
  setSelectedID,
  isSelected,
}: MiniCardsProjectProps) {
  return (
    <div
      className={`scenario-explorator-modal-part-itemslist-minicard project with-image ${
        isSelected ? 'selected' : ''
      } ${project.studies && project.studies.length > 0 ? '' : 'empty'}`}
      role="button"
      tabIndex={0}
      onClick={() =>
        !isSelected && project.studies && project.studies.length > 0 && setSelectedID(project.id)
      }
    >
      <div className="scenario-explorator-modal-part-itemslist-minicard-img">
        <Project2Image project={project} />
      </div>
      <div>{project.name}</div>
    </div>
  );
}
