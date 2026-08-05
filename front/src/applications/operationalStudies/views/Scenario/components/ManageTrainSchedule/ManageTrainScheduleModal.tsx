import { ChevronLeft, ChevronRight } from '@osrd-project/ui-icons';

import { ManageTrainScheduleContextProvider } from 'applications/operationalStudies/hooks/useManageTrainScheduleContext';

import ManageTrainSchedule from './ManageTrainSchedule';
import ManageTrainScheduleLeftPanel, {
  type ManageTrainScheduleLeftPanelProps,
} from './ManageTrainScheduleLeftPanel';

type ManageTrainScheduleModalProps = ManageTrainScheduleLeftPanelProps & {
  setCollapsedTimetableEdit: () => void;
  collapsedTimetableEdit: boolean;
  closeViewAndOpenTableBoard: (closeView: () => void) => void;
};

const ManageTrainScheduleModal = ({
  setCollapsedTimetableEdit,
  collapsedTimetableEdit,
  closeViewAndOpenTableBoard,
}: ManageTrainScheduleModalProps) => (
  <div className="scenario-manage-train-schedule-modal">
    <ManageTrainScheduleContextProvider>
      <ManageTrainScheduleLeftPanel closeViewAndOpenTableBoard={closeViewAndOpenTableBoard} />

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
    </ManageTrainScheduleContextProvider>
  </div>
);

export default ManageTrainScheduleModal;
