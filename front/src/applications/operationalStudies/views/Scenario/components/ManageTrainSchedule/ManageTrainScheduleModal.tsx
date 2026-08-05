import { ChevronLeft, ChevronRight } from '@osrd-project/ui-icons';

import { ManageTrainScheduleContextProvider } from 'applications/operationalStudies/hooks/useManageTrainScheduleContext';
import { useTimetableContext } from 'applications/operationalStudies/hooks/useTimetableContext';

import { MANAGE_TRAIN_SCHEDULE_TYPES } from '../../consts';
import ManageTrainSchedule from './ManageTrainSchedule';
import ManageTrainScheduleLeftPanel, {
  type ManageTrainScheduleLeftPanelProps,
} from './ManageTrainScheduleLeftPanel';

type ManageTrainScheduleModalProps = ManageTrainScheduleLeftPanelProps & {
  displayTrainScheduleManagement: string;
  setDisplayTrainScheduleManagement: (type: string) => void;
  setCollapsedTimetableEdit: () => void;
  collapsedTimetableEdit: boolean;
  closeViewAndOpenTableBoard: (closeView: () => void) => void;
};

const ManageTrainScheduleModal = ({
  displayTrainScheduleManagement,
  setDisplayTrainScheduleManagement,
  trainScheduleToEditData,
  setTrainScheduleToEditData,
  setCollapsedTimetableEdit,
  collapsedTimetableEdit,
  closeViewAndOpenTableBoard,
}: ManageTrainScheduleModalProps) => {
  const { upsertTrainSchedules } = useTimetableContext();

  return (
    <div className="scenario-manage-train-schedule-modal">
      <ManageTrainScheduleContextProvider>
        <ManageTrainScheduleLeftPanel
          displayTrainScheduleManagement={displayTrainScheduleManagement}
          setDisplayTrainScheduleManagement={setDisplayTrainScheduleManagement}
          upsertTrainSchedules={upsertTrainSchedules}
          trainScheduleToEditData={trainScheduleToEditData}
          setTrainScheduleToEditData={setTrainScheduleToEditData}
          closeViewAndOpenTableBoard={closeViewAndOpenTableBoard}
        />

        {(displayTrainScheduleManagement === MANAGE_TRAIN_SCHEDULE_TYPES.add ||
          displayTrainScheduleManagement === MANAGE_TRAIN_SCHEDULE_TYPES.edit) && (
          <div
            className={`scenario-manage-train-schedule${collapsedTimetableEdit ? ' collapsed' : ''}`}
            data-testid="manage-train-schedule"
          >
            <div className="scenario-manage-train-schedule-content">
              <ManageTrainSchedule />
            </div>
            <button
              className="timetable-edit-collapse-button"
              type="button"
              onClick={setCollapsedTimetableEdit}
            >
              {collapsedTimetableEdit ? <ChevronRight /> : <ChevronLeft />}
            </button>
          </div>
        )}
      </ManageTrainScheduleContextProvider>
    </div>
  );
};

export default ManageTrainScheduleModal;
