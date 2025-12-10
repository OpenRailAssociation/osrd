import { ChevronLeft, ChevronRight } from '@osrd-project/ui-icons';

import { ManageTimetableItemContextProvider } from 'applications/operationalStudies/hooks/useManageTimetableItemContext';
import type { TrainScheduleSet } from 'common/api/osrdEditoastApi';

import ImportTimetableItem from '../ImportTimetableItem';
import ManageTimetableItem from './ManageTimetableItem';
import ManageTimetableItemLeftPanel, {
  type ManageTimetableItemLeftPanelProps,
} from './ManageTimetableItemLeftPanel';
import { MANAGE_TIMETABLE_ITEM_TYPES } from '../../consts';
import { TrainScheduleSetCatalogDialog } from '../ImportTrainScheduleSets';

type ManageTimetableItemModalProps = ManageTimetableItemLeftPanelProps & {
  setCollapsedTimetableEdit: () => void;
  collapsedTimetableEdit: boolean;
  trainScheduleSetsAlreadyImported: Set<TrainScheduleSet['id']>;
};

const ManageTimetableItemModal = ({
  displayTimetableItemManagement,
  setDisplayTimetableItemManagement,
  upsertTimetableItems,
  timetableItemToEditData,
  setTimetableItemToEditData,
  setCollapsedTimetableEdit,
  collapsedTimetableEdit,
  trainScheduleSetsAlreadyImported,
}: ManageTimetableItemModalProps) => (
  <div className="scenario-manage-timetable-item-modal">
    <ManageTimetableItemLeftPanel
      displayTimetableItemManagement={displayTimetableItemManagement}
      setDisplayTimetableItemManagement={setDisplayTimetableItemManagement}
      upsertTimetableItems={upsertTimetableItems}
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

    {displayTimetableItemManagement === MANAGE_TIMETABLE_ITEM_TYPES.catalog && (
      <TrainScheduleSetCatalogDialog
        trainScheduleSetsAlreadyImported={trainScheduleSetsAlreadyImported}
        onSubmit={(data) => {
          //TODO: do the glue when mock will be removed
          console.debug('Import from catalog', data);
          setDisplayTimetableItemManagement(MANAGE_TIMETABLE_ITEM_TYPES.none);
        }}
        onCancel={() => setDisplayTimetableItemManagement(MANAGE_TIMETABLE_ITEM_TYPES.none)}
      />
    )}
  </div>
);

export default ManageTimetableItemModal;
