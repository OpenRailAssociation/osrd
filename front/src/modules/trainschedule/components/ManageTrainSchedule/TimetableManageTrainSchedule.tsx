import { useState } from 'react';

import { ChevronLeft, Pencil } from '@osrd-project/ui-icons';
import { useTranslation } from 'react-i18next';

import { MANAGE_TRAIN_SCHEDULE_TYPES } from 'applications/operationalStudies/consts';
import type { InfraState, TrainScheduleResult } from 'common/api/osrdEditoastApi';
import DotsLoader from 'common/DotsLoader/DotsLoader';
import TrainAddingSettings from 'modules/trainschedule/components/ManageTrainSchedule/TrainAddingSettings';

import AddTrainScheduleButton from './AddTrainScheduleButton';
import useUpdateTrainSchedule from './hooks/useUpdateTrainSchedule';

type TimetableManageTrainScheduleProps = {
  displayTrainScheduleManagement: string;
  trainIdToEdit?: number;
  setDisplayTrainScheduleManagement: (type: string) => void;
  upsertTrainSchedules: (trainSchedules: TrainScheduleResult[]) => void;
  infraState?: InfraState;
  setTrainIdToEdit: (trainIdToEdit?: number) => void;
};

const TimetableManageTrainSchedule = ({
  displayTrainScheduleManagement,
  setDisplayTrainScheduleManagement,
  upsertTrainSchedules,
  infraState,
  trainIdToEdit,
  setTrainIdToEdit,
}: TimetableManageTrainScheduleProps) => {
  const { t } = useTranslation('operationalStudies/manageTrainSchedule');
  const [isWorking, setIsWorking] = useState(false);

  const leaveManageTrainSchedule = () => {
    setDisplayTrainScheduleManagement(MANAGE_TRAIN_SCHEDULE_TYPES.none);
    setTrainIdToEdit(undefined);
  };

  const updateTrainSchedule = useUpdateTrainSchedule(
    setIsWorking,
    setDisplayTrainScheduleManagement,
    upsertTrainSchedules,
    setTrainIdToEdit,
    trainIdToEdit
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
              />
            )}
            <TrainAddingSettings />
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
