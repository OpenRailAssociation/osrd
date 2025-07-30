import { ChevronLeft, ChevronRight } from '@osrd-project/ui-icons';

import { ManageTimetableItemContextProvider } from 'applications/operationalStudies/hooks/useManageTimetableItemContext';
import TimetableManageItem, {
  type TimetableManageItemProps,
} from 'modules/timetableItem/components/ManageTimetableItem/TimetableManageItem';

import ImportTimetableItem from './ImportTimetableItem';
import ManageTimetableItem from './ManageTimetableItem';
import { MANAGE_TIMETABLE_ITEM_TYPES } from '../consts';

type ManageTimetableItemModalProps = TimetableManageItemProps & {
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
    />

    {(displayTimetableItemManagement === MANAGE_TIMETABLE_ITEM_TYPES.add ||
      displayTimetableItemManagement === MANAGE_TIMETABLE_ITEM_TYPES.edit) && (
      <div
        className={`scenario-manage-timetable-item${collapsedTimetableEdit ? ' collapsed' : ''}`}
        data-testid="manage-timetable-item"
      >
        <div className="scenario-manage-timetable-item-content">
          <ManageTimetableItemContextProvider>
            <ManageTimetableItem />
          </ManageTimetableItemContextProvider>
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

    {displayTimetableItemManagement === MANAGE_TIMETABLE_ITEM_TYPES.import && (
      <div className="scenario-manage-timetable-item">
        <ImportTimetableItem upsertTimetableItems={upsertTimetableItems} />
      </div>
    )}
  </div>
);

export default ManageTimetableItemModal;
