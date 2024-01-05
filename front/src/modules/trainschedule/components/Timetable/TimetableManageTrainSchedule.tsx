import React, { useState } from 'react';
import { useDispatch } from 'react-redux';
import { useTranslation } from 'react-i18next';

import { MANAGE_TRAIN_SCHEDULE_TYPES } from 'applications/operationalStudies/consts';

import DotsLoader from 'common/DotsLoader/DotsLoader';
import TrainAddingSettings from 'modules/trainschedule/components/ManageTrainSchedule/TrainAddingSettings';
import {
  SubmitConfAddTrainSchedule,
  SubmitConfUpdateTrainSchedules,
} from 'modules/trainschedule/components/ManageTrainSchedule';

import { useOsrdConfActions } from 'common/osrdContext';
import type { Infra } from 'common/api/osrdEditoastApi';

type TimetableManageTrainScheduleProps = {
  displayTrainScheduleManagement: string;
  setDisplayTrainScheduleManagement: (type: string) => void;
  setTrainResultsToFetch: (trainScheduleIds?: number[]) => void;
  infraState?: Infra['state'];
  refetchTimetable: () => void;
  refetchConflicts: () => void;
};

export default function TimetableManageTrainSchedule({
  displayTrainScheduleManagement,
  setDisplayTrainScheduleManagement,
  setTrainResultsToFetch,
  infraState,
  refetchTimetable,
  refetchConflicts,
}: TimetableManageTrainScheduleProps) {
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
          <SubmitConfUpdateTrainSchedules
            setIsWorking={setIsWorking}
            setDisplayTrainScheduleManagement={setDisplayTrainScheduleManagement}
            setTrainResultsToFetch={setTrainResultsToFetch}
          />
        )}

        {displayTrainScheduleManagement === MANAGE_TRAIN_SCHEDULE_TYPES.add && (
          <>
            {isWorking ? (
              <button className="btn btn-primary disabled mb-2" type="button">
                <DotsLoader />
              </button>
            ) : (
              <SubmitConfAddTrainSchedule
                infraState={infraState}
                refetchTimetable={refetchTimetable}
                setIsWorking={setIsWorking}
                refetchConflicts={refetchConflicts}
                setTrainResultsToFetch={setTrainResultsToFetch}
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
          <i className="icons-arrow-prev mr-2" />
          {t('returnToSimulationResults')}
        </button>
      </div>
    </div>
  );
}
