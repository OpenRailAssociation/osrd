import React, { useState } from 'react';
import { MANAGE_TRAIN_SCHEDULE_TYPES } from 'applications/operationalStudies/consts';
import { useTranslation } from 'react-i18next';
import { updateTrainScheduleIDsToModify } from 'reducers/osrdconf';
import DotsLoader from 'common/DotsLoader/DotsLoader';
import { useDispatch } from 'react-redux';
import TrainAddingSettings from 'modules/trainschedule/components/ManageTrainSchedule/TrainAddingSettings';
import { Infra } from 'common/api/osrdEditoastApi';
import {
  SubmitConfAddTrainSchedule,
  SubmitConfUpdateTrainSchedules,
} from 'modules/trainschedule/components/ManageTrainSchedule';

type Props = {
  displayTrainScheduleManagement: string;
  setDisplayTrainScheduleManagement: (type: string) => void;
  infraState?: Infra['state'];
  refetchTimetable: () => void;
};

export default function TimetableManageTrainSchedule({
  displayTrainScheduleManagement,
  setDisplayTrainScheduleManagement,
  infraState,
  refetchTimetable,
}: Props) {
  const { t } = useTranslation('operationalStudies/manageTrainSchedule');
  const dispatch = useDispatch();
  const [isWorking, setIsWorking] = useState(false);

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
