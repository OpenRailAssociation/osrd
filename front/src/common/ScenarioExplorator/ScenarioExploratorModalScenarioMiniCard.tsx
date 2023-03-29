import React, { useContext } from 'react';
import { useDispatch } from 'react-redux';
import { ModalContext } from 'common/BootstrapSNCF/ModalSNCF/ModalProvider';
import {
  updateInfraID,
  updateProjectID,
  updateScenarioID,
  updateStudyID,
  updateTimetableID,
} from 'reducers/osrdconf';
import { MiniCardsScenarioProps } from './ScenarioExploratorTypes';

export default function ScenarioMiniCard({
  scenario,
  setSelectedID,
  isSelected,
  projectID,
  studyID,
}: MiniCardsScenarioProps) {
  const dispatch = useDispatch();
  const { closeModal } = useContext(ModalContext);
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
      className={`scenario-explorator-modal-part-itemslist-minicard scenario ${
        isSelected ? 'selected' : ''
      }`}
      role="button"
      tabIndex={0}
      onClick={selectScenario}
    >
      <div>{scenario.name}</div>
    </div>
  );
}
