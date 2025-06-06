import TimetableManageTrainSchedule, {
  type TimetableManageTrainScheduleProps,
} from 'modules/trainschedule/components/ManageTrainSchedule/TimetableManageTrainSchedule';

import { MANAGE_TRAIN_SCHEDULE_TYPES } from '../consts';
import ImportTimetableItem from './ImportTimetableItem';
import ManageTrainSchedule from './ManageTrainSchedule';
import { ManageTrainScheduleContextProvider } from '../hooks/useManageTrainScheduleContext';

type ManageTrainScheduleModalProps = TimetableManageTrainScheduleProps & {
  timetableId: number;
};

const ManageTrainScheduleModal = ({
  displayTrainScheduleManagement,
  setDisplayTrainScheduleManagement,
  upsertTimetableItems,
  removeTimetableItems,
  itemIdToEdit,
  setItemIdToEdit,
  infraState,
  timetableId,
}: ManageTrainScheduleModalProps) => (
  <div className="scenario-managetrainschedule-modal">
    <TimetableManageTrainSchedule
      displayTrainScheduleManagement={displayTrainScheduleManagement}
      setDisplayTrainScheduleManagement={setDisplayTrainScheduleManagement}
      upsertTimetableItems={upsertTimetableItems}
      removeTimetableItems={removeTimetableItems}
      itemIdToEdit={itemIdToEdit}
      setItemIdToEdit={setItemIdToEdit}
      infraState={infraState}
    />

    {(displayTrainScheduleManagement === MANAGE_TRAIN_SCHEDULE_TYPES.add ||
      displayTrainScheduleManagement === MANAGE_TRAIN_SCHEDULE_TYPES.edit) && (
      <div className="scenario-managetrainschedule" data-testid="manage-train-schedule">
        <ManageTrainScheduleContextProvider>
          <ManageTrainSchedule />
        </ManageTrainScheduleContextProvider>
      </div>
    )}

    {displayTrainScheduleManagement === MANAGE_TRAIN_SCHEDULE_TYPES.import && (
      <div className="scenario-managetrainschedule">
        <ImportTimetableItem
          timetableId={timetableId}
          upsertTimetableItems={upsertTimetableItems}
        />
      </div>
    )}
  </div>
);

export default ManageTrainScheduleModal;
