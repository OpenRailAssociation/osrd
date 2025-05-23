import { useContext } from 'react';

import cx from 'classnames';

import {
  osrdEditoastApi,
  type ProjectWithStudies,
  type ScenarioWithDetails,
  type StudyWithScenarios,
} from 'common/api/osrdEditoastApi';
import { ModalContext } from 'common/BootstrapSNCF/ModalSNCF/ModalProvider';
import { getScenarioDatetimeWindow } from 'modules/scenario/helpers/utils';
import { resetStdcmSimulations, updateStdcmEnvironment } from 'reducers/osrdconf/stdcmConf';
import { useAppDispatch } from 'store';

import Project2Image from './ScenarioExplorerProject2Image';

type MiniCardProps = {
  isSelected?: boolean;
};

type MiniCardProjectProps = MiniCardProps & {
  project: ProjectWithStudies;
  setSelectedID: (id: number) => void;
};
type MiniCardStudyProps = MiniCardProps & {
  study: StudyWithScenarios;
  setSelectedID: (id: number) => void;
};
type MiniCardScenarioProps = MiniCardProps & {
  scenario: ScenarioWithDetails;
  projectID: number;
  studyID: number;
};

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
  isSelected,
  projectID,
  studyID,
}: MiniCardScenarioProps) => {
  const dispatch = useAppDispatch();
  const { closeModal } = useContext(ModalContext);

  const [getTimetableTrainSchedules] =
    osrdEditoastApi.endpoints.getAllTimetableByIdTrainSchedules.useLazyQuery();

  const selectScenario = async () => {
    const trainSchedules = await getTimetableTrainSchedules({
      timetableId: scenario.timetable_id,
    }).unwrap();

    const scenarioDateTimeWindow = getScenarioDatetimeWindow(trainSchedules);

    dispatch(resetStdcmSimulations());
    dispatch(
      updateStdcmEnvironment({
        infraID: scenario.infra_id,
        timetableID: scenario.timetable_id,
        electricalProfileSetId: scenario.electrical_profile_set_id,
        searchDatetimeWindow: scenarioDateTimeWindow,
        projectID,
        studyID,
        scenarioID: scenario.id,
      })
    );

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
