import { useState } from 'react';

import { ChevronLeft, Pencil } from '@osrd-project/ui-icons';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import { MANAGE_TRAIN_SCHEDULE_TYPES } from 'applications/operationalStudies/consts';
import type { InfraState } from 'common/api/osrdEditoastApi';
import CheckboxRadioSNCF from 'common/BootstrapSNCF/CheckboxRadioSNCF';
import DotsLoader from 'common/DotsLoader';
import TrainAddingSettings from 'modules/trainschedule/components/ManageTrainSchedule/TrainAddingSettings';
import type { TimetableItemId, TrainScheduleResultWithTrainId } from 'reducers/osrdconf/types';
import { getUserPreferences } from 'reducers/user/userSelectors';

import AddTrainScheduleButton from './AddTrainScheduleButton';
import useUpdateTrainSchedule from './hooks/useUpdateTrainSchedule';
import PacedTrainSettings from './PacedTrainSettings';

type TimetableManageTrainScheduleProps = {
  displayTrainScheduleManagement: string;
  itemIdToEdit?: TimetableItemId;
  setDisplayTrainScheduleManagement: (type: string) => void;
  upsertTrainSchedules: (trainSchedules: TrainScheduleResultWithTrainId[]) => void;
  infraState?: InfraState;
  setItemIdToEdit: (itemIdToEdit?: TimetableItemId) => void;
  dtoImport: () => void;
};

const TimetableManageTrainSchedule = ({
  displayTrainScheduleManagement,
  setDisplayTrainScheduleManagement,
  upsertTrainSchedules,
  infraState,
  itemIdToEdit,
  setItemIdToEdit,
  dtoImport,
}: TimetableManageTrainScheduleProps) => {
  const { t } = useTranslation('operationalStudies/manageTrainSchedule');
  const { showPacedTrains } = useSelector(getUserPreferences);

  const [isWorking, setIsWorking] = useState(false);
  const [isPacedTrainMode, setIsPacedTrainMode] = useState(false);

  const leaveManageTrainSchedule = () => {
    setDisplayTrainScheduleManagement(MANAGE_TRAIN_SCHEDULE_TYPES.none);
    setItemIdToEdit(undefined);
  };

  const updateTrainSchedule = useUpdateTrainSchedule(
    setIsWorking,
    setDisplayTrainScheduleManagement,
    upsertTrainSchedules,
    setItemIdToEdit,
    dtoImport,
    itemIdToEdit
  );
  return (
    <div className="scenario-timetable-managetrainschedule">
      <div className="scenario-timetable-managetrainschedule-header">
        {displayTrainScheduleManagement === MANAGE_TRAIN_SCHEDULE_TYPES.edit && (
          <button
            className="btn btn-warning"
            type="button"
            onClick={updateTrainSchedule}
            data-testid="submit-edit-train-schedule"
          >
            <span className="mr-2">
              <Pencil size="lg" />
            </span>
            {t('updateTrainSchedule')}
          </button>
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
                upsertTrainSchedules={upsertTrainSchedules}
                dtoImport={dtoImport}
                isPacedTrainMode={isPacedTrainMode}
                setDisplayTrainScheduleManagement={setDisplayTrainScheduleManagement}
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
                  checked={isPacedTrainMode}
                  onChange={() => setIsPacedTrainMode(!isPacedTrainMode)}
                />
                {isPacedTrainMode && <PacedTrainSettings />}
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
