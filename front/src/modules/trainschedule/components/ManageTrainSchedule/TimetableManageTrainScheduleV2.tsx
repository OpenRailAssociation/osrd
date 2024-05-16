import React, { useState } from 'react';

import { ChevronLeft } from '@osrd-project/ui-icons';
import { useTranslation } from 'react-i18next';
import { useDispatch } from 'react-redux';

import { MANAGE_TRAIN_SCHEDULE_TYPES } from 'applications/operationalStudies/consts';
import type { InfraState } from 'common/api/osrdEditoastApi';
import DotsLoader from 'common/DotsLoader/DotsLoader';
import { useOsrdConfActions } from 'common/osrdContext';
import TrainAddingSettings from 'modules/trainschedule/components/ManageTrainSchedule/TrainAddingSettings';

import AddTrainScheduleV2Button from './AddTrainScheduleV2Button';
import SubmitConfUpdateTrainSchedulesV2 from './SubmitConfUpdateTrainSchedulesV2';

type TimetableManageTrainScheduleProps = {
  displayTrainScheduleManagement: string;
  setDisplayTrainScheduleManagement: (type: string) => void;
  setTrainResultsToFetch: (trainScheduleIds?: number[]) => void;
  infraState?: InfraState;
  // refetchTimetable: () => void;
  // refetchConflicts: () => void;
};

const TimetableManageTrainScheduleV2 = ({
  displayTrainScheduleManagement,
  setDisplayTrainScheduleManagement,
  setTrainResultsToFetch,
  infraState,
  // refetchTimetable,
  // refetchConflicts,
}: TimetableManageTrainScheduleProps) => {
  const { t } = useTranslation('operationalStudies/manageTrainSchedule');
  const dispatch = useDispatch();
  const [isWorking, setIsWorking] = useState(false);
  const { updateTrainScheduleIDsToModify } = useOsrdConfActions();

  const leaveManageTrainSchedule = () => {
    setDisplayTrainScheduleManagement(MANAGE_TRAIN_SCHEDULE_TYPES.none);
    dispatch(updateTrainScheduleIDsToModify([]));
  };

  return (
    <div className="scenario-timetable-managetrainschedule">
      <div className="scenario-timetable-managetrainschedule-header">
        {displayTrainScheduleManagement === MANAGE_TRAIN_SCHEDULE_TYPES.edit && (
          <SubmitConfUpdateTrainSchedulesV2
            setIsWorking={setIsWorking}
            setDisplayTrainScheduleManagement={setDisplayTrainScheduleManagement}
            setTrainResultsToFetch={setTrainResultsToFetch}
          />
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
              <AddTrainScheduleV2Button
                infraState={infraState}
                // refetchTimetable={refetchTimetable}
                setIsWorking={setIsWorking}
                // refetchConflicts={refetchConflicts}
                // setTrainResultsToFetch={setTrainResultsToFetch}
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

export default TimetableManageTrainScheduleV2;
