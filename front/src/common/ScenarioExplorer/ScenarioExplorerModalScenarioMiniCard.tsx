import React, { useContext } from 'react';
import { useDispatch } from 'react-redux';
import cx from 'classnames';

import { useOsrdConfActions } from 'common/osrdContext';
import { ModalContext } from 'common/BootstrapSNCF/ModalSNCF/ModalProvider';
import { MiniCardsScenarioProps } from 'common/ScenarioExplorer/ScenarioExplorerTypes';

export default function ScenarioMiniCard({
  scenario,
  setSelectedID,
  isSelected,
  projectID,
  studyID,
}: MiniCardsScenarioProps) {
  const dispatch = useDispatch();
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
      <div>{scenario.name}</div>
    </div>
  );
}
