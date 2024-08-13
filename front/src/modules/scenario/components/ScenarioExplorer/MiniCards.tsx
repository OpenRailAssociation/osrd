import React, { useContext } from 'react';

import cx from 'classnames';

import type {
  ProjectWithStudies,
  ScenarioWithDetails,
  StudyWithScenarios,
} from 'common/api/osrdEditoastApi';
import { ModalContext } from 'common/BootstrapSNCF/ModalSNCF/ModalProvider';
import { useOsrdConfActions } from 'common/osrdContext';
import { useAppDispatch } from 'store';

import Project2Image from './ScenarioExplorerProject2Image';

type MiniCardProps = {
  isSelected?: boolean;
  setSelectedID: (arg0?: number) => void;
};

interface MiniCardProjectProps extends MiniCardProps {
  project: ProjectWithStudies;
}
interface MiniCardStudyProps extends MiniCardProps {
  study: StudyWithScenarios;
}
interface MiniCardScenarioProps extends MiniCardProps {
  scenario: ScenarioWithDetails;
  projectID: number;
  studyID: number;
}

export const ProjectMiniCard = ({ project, setSelectedID, isSelected }: MiniCardProjectProps) => (
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
    <div className="text-truncate" title={project.name}>
      {project.name}
    </div>
  </div>
);

export const StudyMiniCard = ({ study, setSelectedID, isSelected }: MiniCardStudyProps) => (
  <div
    className={cx('minicard', 'study', {
      selected: isSelected,
      empty: study.scenarios_count === 0,
    })}
    role="button"
    tabIndex={0}
    onClick={() => setSelectedID(study.id)}
  >
    <div className="text-truncate" title={study.name}>
      {study.name}
    </div>
  </div>
);

export const ScenarioMiniCard = ({
  scenario,
  setSelectedID,
  isSelected,
  projectID,
  studyID,
}: MiniCardScenarioProps) => {
  const dispatch = useAppDispatch();
  const { closeModal } = useContext(ModalContext);
  const { updateInfraID, updateProjectID, updateScenarioID, updateStudyID, updateTimetableID } =
    useOsrdConfActions();
  const selectScenario = () => {
    setSelectedID(scenario.id);
    dispatch(updateProjectID(projectID));
    dispatch(updateStudyID(studyID));
    dispatch(updateScenarioID(scenario.id));
    dispatch(updateInfraID(scenario.infra_id));
    dispatch(updateTimetableID(scenario.timetable_id));
    closeModal();
  };
  return (
    <div
      className={cx('minicard', 'scenario', {
        selected: isSelected,
      })}
      role="button"
      tabIndex={0}
      onClick={selectScenario}
    >
      <div className="text-truncate" title={scenario.name}>
        {scenario.name}
      </div>
    </div>
  );
};
