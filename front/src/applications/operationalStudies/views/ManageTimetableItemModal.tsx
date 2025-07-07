import { ChevronLeft, ChevronRight } from '@osrd-project/ui-icons';

import type { ScenarioResponse } from 'common/api/osrdEditoastApi';
import TimetableManageItem, {
  type TimetableManageItemProps,
} from 'modules/trainschedule/components/ManageTrainSchedule/TimetableManageItem';

import { MANAGE_TRAIN_SCHEDULE_TYPES } from '../consts';
import ImportTimetableItem from './ImportTimetableItem';
import ManageTimetableItem from './ManageTimetableItem';
import { ManageTrainScheduleContextProvider } from '../hooks/useManageTrainScheduleContext';

type ManageTimetableItemModalProps = TimetableManageItemProps & {
  scenario: ScenarioResponse;
  setCollapsedTimetableEdit: () => void;
  collapsedTimetableEdit: boolean;
};

const ManageTimetableItemModal = ({
  displayTimetableItemManagement,
  setDisplayTimetableItemManagement,
  upsertTimetableItems,
  removeTimetableItems,
  timetableItemToEditData,
  setTimetableItemToEditData,
  scenario,
  infraState,
  setCollapsedTimetableEdit,
  collapsedTimetableEdit,
}: ManageTimetableItemModalProps) => (
  <div className="scenario-manage-timetable-item-modal">
    <TimetableManageItem
      displayTimetableItemManagement={displayTimetableItemManagement}
      setDisplayTimetableItemManagement={setDisplayTimetableItemManagement}
      upsertTimetableItems={upsertTimetableItems}
      removeTimetableItems={removeTimetableItems}
      timetableItemToEditData={timetableItemToEditData}
      setTimetableItemToEditData={setTimetableItemToEditData}
      infraState={infraState}
    />

    {(displayTimetableItemManagement === MANAGE_TRAIN_SCHEDULE_TYPES.add ||
      displayTimetableItemManagement === MANAGE_TRAIN_SCHEDULE_TYPES.edit) && (
      <div
        className={`scenario-manage-timetable-item${collapsedTimetableEdit ? ' collapsed' : ''}`}
        data-testid="manage-timetable-item"
      >
        <div className="scenario-manage-timetable-item-content">
          <ManageTrainScheduleContextProvider>
            <ManageTimetableItem />
          </ManageTrainScheduleContextProvider>
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

    {displayTimetableItemManagement === MANAGE_TRAIN_SCHEDULE_TYPES.import && (
      <div className="scenario-manage-timetable-item">
        <ImportTimetableItem scenario={scenario} upsertTimetableItems={upsertTimetableItems} />
      </div>
    )}
  </div>
);

export default ManageTimetableItemModal;
