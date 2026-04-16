import { ChevronLeft, ChevronRight } from '@osrd-project/ui-icons';
import { useDispatch } from 'react-redux';

import { ManageTrainScheduleContextProvider } from 'applications/operationalStudies/hooks/useManageTrainScheduleContext';
import type useScenarioTrainScheduleSet from 'applications/operationalStudies/hooks/useScenarioTrainScheduleSet';
import type { ImportTrainScheduleSetsPayload } from 'applications/operationalStudies/hooks/useScenarioTrainScheduleSet';
import { setFailure } from 'reducers/main';
import { castErrorToFailure } from 'utils/error';

import { MANAGE_TRAIN_SCHEDULE_TYPES } from '../../consts';
import { TrainScheduleSetCatalogDialog } from '../ImportTrainScheduleSets';
import ManageTrainSchedule from './ManageTrainSchedule';
import ManageTrainScheduleLeftPanel, {
  type ManageTrainScheduleLeftPanelProps,
} from './ManageTrainScheduleLeftPanel';

type ManageTrainScheduleModalProps = ManageTrainScheduleLeftPanelProps & {
  setCollapsedTimetableEdit: () => void;
  collapsedTimetableEdit: boolean;
  importTrainScheduleSets: ReturnType<
    typeof useScenarioTrainScheduleSet
  >['importTrainScheduleSets'];
};

const ManageTrainScheduleModal = ({
  displayTrainScheduleManagement,
  setDisplayTrainScheduleManagement,
  upsertTimetableItems,
  trainScheduleToEditData,
  setTrainScheduleToEditData,
  setCollapsedTimetableEdit,
  collapsedTimetableEdit,
  importTrainScheduleSets,
}: ManageTrainScheduleModalProps) => {
  const dispatch = useDispatch();

  const handleImportTrainScheduleSets = async (data: ImportTrainScheduleSetsPayload) => {
    try {
      await importTrainScheduleSets(data);
      setDisplayTrainScheduleManagement(MANAGE_TRAIN_SCHEDULE_TYPES.none);
    } catch (error) {
      dispatch(setFailure(castErrorToFailure(error)));
    }
  };

  return (
    <div className="scenario-manage-train-schedule-modal">
      <ManageTrainScheduleContextProvider>
        <ManageTrainScheduleLeftPanel
          displayTrainScheduleManagement={displayTrainScheduleManagement}
          setDisplayTrainScheduleManagement={setDisplayTrainScheduleManagement}
          upsertTimetableItems={upsertTimetableItems}
          trainScheduleToEditData={trainScheduleToEditData}
          setTrainScheduleToEditData={setTrainScheduleToEditData}
        />

        {(displayTrainScheduleManagement === MANAGE_TRAIN_SCHEDULE_TYPES.add ||
          displayTrainScheduleManagement === MANAGE_TRAIN_SCHEDULE_TYPES.edit) && (
          <div
            className={`scenario-manage-train-schedule${collapsedTimetableEdit ? ' collapsed' : ''}`}
            data-testid="manage-timetable-item"
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

        {displayTrainScheduleManagement === MANAGE_TRAIN_SCHEDULE_TYPES.catalog && (
          <TrainScheduleSetCatalogDialog
            onSubmit={handleImportTrainScheduleSets}
            onCancel={() => setDisplayTrainScheduleManagement(MANAGE_TRAIN_SCHEDULE_TYPES.none)}
          />
        )}
      </ManageTrainScheduleContextProvider>
    </div>
  );
};

export default ManageTrainScheduleModal;
