import { ChevronLeft, ChevronRight } from '@osrd-project/ui-icons';
import { useDispatch } from 'react-redux';

import { ManageTrainScheduleContextProvider } from 'applications/operationalStudies/hooks/useManageTrainScheduleContext';
import type useScenarioTrainScheduleSet from 'applications/operationalStudies/hooks/useScenarioTrainScheduleSet';
import type { ImportTrainScheduleSetsPayload } from 'applications/operationalStudies/hooks/useScenarioTrainScheduleSet';
import { setFailure } from 'reducers/main';
import { castErrorToFailure } from 'utils/error';

import { MANAGE_TIMETABLE_ITEM_TYPES } from '../../consts';
import { TrainScheduleSetCatalogDialog } from '../ImportTrainScheduleSets';
import ManageTimetableItemLeftPanel, {
  type ManageTimetableItemLeftPanelProps,
} from './ManageTimetableItemLeftPanel';
import ManageTrainSchedule from './ManageTrainSchedule';

type ManageTimetableItemModalProps = ManageTimetableItemLeftPanelProps & {
  setCollapsedTimetableEdit: () => void;
  collapsedTimetableEdit: boolean;
  importTrainScheduleSets: ReturnType<
    typeof useScenarioTrainScheduleSet
  >['importTrainScheduleSets'];
};

const ManageTimetableItemModal = ({
  displayTimetableItemManagement,
  setDisplayTimetableItemManagement,
  upsertTimetableItems,
  trainScheduleToEditData,
  setTrainScheduleToEditData,
  setCollapsedTimetableEdit,
  collapsedTimetableEdit,
  importTrainScheduleSets,
}: ManageTimetableItemModalProps) => {
  const dispatch = useDispatch();

  const handleImportTrainScheduleSets = async (data: ImportTrainScheduleSetsPayload) => {
    try {
      await importTrainScheduleSets(data);
      setDisplayTimetableItemManagement(MANAGE_TIMETABLE_ITEM_TYPES.none);
    } catch (error) {
      dispatch(setFailure(castErrorToFailure(error)));
    }
  };

  return (
    <div className="scenario-manage-timetable-item-modal">
      <ManageTrainScheduleContextProvider>
        <ManageTimetableItemLeftPanel
          displayTimetableItemManagement={displayTimetableItemManagement}
          setDisplayTimetableItemManagement={setDisplayTimetableItemManagement}
          upsertTimetableItems={upsertTimetableItems}
          trainScheduleToEditData={trainScheduleToEditData}
          setTrainScheduleToEditData={setTrainScheduleToEditData}
        />

        {(displayTimetableItemManagement === MANAGE_TIMETABLE_ITEM_TYPES.add ||
          displayTimetableItemManagement === MANAGE_TIMETABLE_ITEM_TYPES.edit) && (
          <div
            className={`scenario-manage-timetable-item${collapsedTimetableEdit ? ' collapsed' : ''}`}
            data-testid="manage-timetable-item"
          >
            <div className="scenario-manage-timetable-item-content">
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

        {displayTimetableItemManagement === MANAGE_TIMETABLE_ITEM_TYPES.catalog && (
          <TrainScheduleSetCatalogDialog
            onSubmit={handleImportTrainScheduleSets}
            onCancel={() => setDisplayTimetableItemManagement(MANAGE_TIMETABLE_ITEM_TYPES.none)}
          />
        )}
      </ManageTrainScheduleContextProvider>
    </div>
  );
};

export default ManageTimetableItemModal;
