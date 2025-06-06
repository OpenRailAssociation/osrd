import type { ScenarioResponse } from 'common/api/osrdEditoastApi';
import TimetableManageTrainSchedule, {
  type TimetableManageTrainScheduleProps,
} from 'modules/trainschedule/components/ManageTrainSchedule/TimetableManageTrainSchedule';

import { MANAGE_TRAIN_SCHEDULE_TYPES } from '../consts';
import ImportTimetableItem from './ImportTimetableItem';
import ManageTrainSchedule from './ManageTrainSchedule';
import { ManageTrainScheduleContextProvider } from '../hooks/useManageTrainScheduleContext';

type ManageTrainScheduleModalProps = TimetableManageTrainScheduleProps & {
  scenario: ScenarioResponse;
};

const ManageTrainScheduleModal = ({
  displayTrainScheduleManagement,
  setDisplayTrainScheduleManagement,
  upsertTimetableItems,
  removeTimetableItems,
  timetableItemToEditData,
  setTimetableItemToEditData,
  scenario,
  infraState,
}: ManageTrainScheduleModalProps) => (
  <div className="scenario-managetrainschedule-modal">
    <TimetableManageTrainSchedule
      displayTrainScheduleManagement={displayTrainScheduleManagement}
      setDisplayTrainScheduleManagement={setDisplayTrainScheduleManagement}
      upsertTimetableItems={upsertTimetableItems}
      removeTimetableItems={removeTimetableItems}
      timetableItemToEditData={timetableItemToEditData}
      setTimetableItemToEditData={setTimetableItemToEditData}
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
        <ImportTimetableItem scenario={scenario} upsertTimetableItems={upsertTimetableItems} />
      </div>
    )}
  </div>
);

export default ManageTrainScheduleModal;
