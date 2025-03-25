import { useState } from 'react';

import { ChevronLeft, Pencil } from '@osrd-project/ui-icons';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import { MANAGE_TRAIN_SCHEDULE_TYPES } from 'applications/operationalStudies/consts';
import type { InfraState } from 'common/api/osrdEditoastApi';
import CheckboxRadioSNCF from 'common/BootstrapSNCF/CheckboxRadioSNCF';
import DotsLoader from 'common/DotsLoader';
import TrainAddingSettings from 'modules/trainschedule/components/ManageTrainSchedule/TrainAddingSettings';
import { toggleEditingTrainIsPacedTrain } from 'reducers/osrdconf/operationalStudiesConf';
import { getEditingTrainIsPacedTrain } from 'reducers/osrdconf/operationalStudiesConf/selectors';
import type { TimetableItemId, TimetableItemWithTimetableId } from 'reducers/osrdconf/types';
import { getUserPreferences } from 'reducers/user/userSelectors';
import { useAppDispatch } from 'store';
import { isPacedTrain, isTrainSchedule } from 'utils/trainId';

import AddTrainScheduleButton from './AddTrainScheduleButton';
import useUpdateTrainSchedule from './hooks/useUpdateTrainSchedule';
import PacedTrainSettings from './PacedTrainSettings';

type TimetableManageTrainScheduleProps = {
  displayTrainScheduleManagement: string;
  itemIdToEdit?: TimetableItemId;
  setDisplayTrainScheduleManagement: (type: string) => void;
  upsertTimetableItems: (timetableItems: TimetableItemWithTimetableId[]) => void;
  removeTimetableItems: (timetableItems: TimetableItemId[]) => void;
  infraState?: InfraState;
  setItemIdToEdit: (itemIdToEdit?: TimetableItemId) => void;
  dtoImport: () => void;
};

const TimetableManageTrainSchedule = ({
  displayTrainScheduleManagement,
  setDisplayTrainScheduleManagement,
  upsertTimetableItems,
  removeTimetableItems,
  infraState,
  itemIdToEdit,
  setItemIdToEdit,
  dtoImport,
}: TimetableManageTrainScheduleProps) => {
  const dispatch = useAppDispatch();
  const { t } = useTranslation('operationalStudies/manageTrainSchedule');
  const { showPacedTrains } = useSelector(getUserPreferences);
  const editingTrainIsPacedTrain = useSelector(getEditingTrainIsPacedTrain);

  const [isWorking, setIsWorking] = useState(false);

  const leaveManageTrainSchedule = () => {
    setDisplayTrainScheduleManagement(MANAGE_TRAIN_SCHEDULE_TYPES.none);
    setItemIdToEdit(undefined);
  };

  // TODO Paced trains : update this to handle edit paced trains
  const updateTrainSchedule = useUpdateTrainSchedule(
    setIsWorking,
    setDisplayTrainScheduleManagement,
    upsertTimetableItems,
    removeTimetableItems,
    setItemIdToEdit,
    dtoImport,
    itemIdToEdit
  );

  const getEditLabel = (_itemIdToEdit: TimetableItemId) => {
    if (!showPacedTrains) return t('updateTrainSchedule');

    if (isTrainSchedule(_itemIdToEdit) && !editingTrainIsPacedTrain) {
      return t('updateTrainSchedule');
    }
    if (isPacedTrain(_itemIdToEdit) && editingTrainIsPacedTrain) {
      return t('updatePacedTrain');
    }
    return isTrainSchedule(_itemIdToEdit)
      ? t('turnTrainScheduleIntoPacedTrain')
      : t('turnPacedTrainIntoTrainSchedule');
  };

  return (
    <div className="scenario-timetable-managetrainschedule">
      <div className="scenario-timetable-managetrainschedule-header">
        {displayTrainScheduleManagement === MANAGE_TRAIN_SCHEDULE_TYPES.edit && itemIdToEdit && (
          <>
            <button
              className="btn btn-warning mb-2"
              type="button"
              onClick={updateTrainSchedule}
              data-testid="submit-edit-train-schedule"
            >
              <span className="mr-2">
                <Pencil size="lg" />
              </span>
              {getEditLabel(itemIdToEdit)}
            </button>
            {showPacedTrains && (
              <div className="osrd-config-item-container">
                <CheckboxRadioSNCF
                  type="checkbox"
                  label={t('pacedTrains.defineService')}
                  id="define-paced-train"
                  name="define-paced-train"
                  containerClassName="mb-0"
                  checked={editingTrainIsPacedTrain}
                  onChange={() => dispatch(toggleEditingTrainIsPacedTrain())}
                />
                {editingTrainIsPacedTrain && <PacedTrainSettings />}
              </div>
            )}
          </>
        )}

        {displayTrainScheduleManagement === MANAGE_TRAIN_SCHEDULE_TYPES.add && (
          <>
            {isWorking ? (
              <button
                className="btn btn-primary disabled mb-2"
                type="button"
                aria-label={t('saving')}
                title={t('saving')}
              >
                <DotsLoader />
              </button>
            ) : (
              <AddTrainScheduleButton
                infraState={infraState}
                setIsWorking={setIsWorking}
                upsertTimetableItems={upsertTimetableItems}
                dtoImport={dtoImport}
                isPacedTrainMode={editingTrainIsPacedTrain}
              />
            )}
            {showPacedTrains ? (
              <div className="osrd-config-item-container">
                <CheckboxRadioSNCF
                  type="checkbox"
                  label={t('pacedTrains.defineService')}
                  id="define-paced-train"
                  name="define-paced-train"
                  containerClassName="mb-0"
                  checked={editingTrainIsPacedTrain}
                  onChange={() => dispatch(toggleEditingTrainIsPacedTrain())}
                />
                {editingTrainIsPacedTrain && <PacedTrainSettings />}
              </div>
            ) : (
              <TrainAddingSettings />
            )}
          </>
        )}
      </div>
      <div
        className="scenario-timetable-managetrainschedule-body"
        role="button"
        tabIndex={0}
        onClick={leaveManageTrainSchedule}
      >
        <button
          className="btn btn-secondary btn-block"
          data-testid="return-simulation-result"
          type="button"
        >
          <span className="mr-2">
            <ChevronLeft size="lg" />
          </span>
          {t('returnToSimulationResults')}
        </button>
      </div>
    </div>
  );
};

export default TimetableManageTrainSchedule;
