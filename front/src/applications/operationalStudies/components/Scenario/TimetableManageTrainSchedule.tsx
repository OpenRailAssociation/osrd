import React, { useState } from 'react';
import { FaPen } from 'react-icons/fa';
import { MANAGE_TRAIN_SCHEDULE_TYPES } from 'applications/operationalStudies/consts';
import { useTranslation } from 'react-i18next';
import { updateTrainScheduleIDsToModify } from 'reducers/osrdconf';
import DotsLoader from 'common/DotsLoader/DotsLoader';
import { useDispatch, useSelector } from 'react-redux';
import { getTrainScheduleIDsToModify } from 'reducers/osrdconf/selectors';
import TrainAddingSettings from 'applications/operationalStudies/components/ManageTrainSchedule/TrainAddingSettings';
import { Infra } from 'common/api/osrdEditoastApi';
import submitConfUpdateTrainSchedules from '../ManageTrainSchedule/helpers/submitConfUpdateTrainSchedules';
import SubmitConfAddTrainSchedule from '../ManageTrainSchedule/SubmitConfAddTrainSchedule';

type Props = {
  displayTrainScheduleManagement: string;
  setDisplayTrainScheduleManagement: (type: string) => void;
  infraState?: Infra['state'];
};

export default function TimetableManageTrainSchedule({
  displayTrainScheduleManagement,
  setDisplayTrainScheduleManagement,
  infraState,
}: Props) {
  const { t } = useTranslation('operationalStudies/manageTrainSchedule');
  const dispatch = useDispatch();
  const trainScheduleIDsToModify: undefined | number[] = useSelector(getTrainScheduleIDsToModify);
  const [isWorking, setIsWorking] = useState(false);

  const leaveManageTrainSchedule = () => {
    setDisplayTrainScheduleManagement(MANAGE_TRAIN_SCHEDULE_TYPES.none);
    dispatch(updateTrainScheduleIDsToModify(undefined));
  };

  return (
    <div className="scenario-timetable-managetrainschedule">
      <div className="scenario-timetable-managetrainschedule-header">
        {displayTrainScheduleManagement === MANAGE_TRAIN_SCHEDULE_TYPES.edit &&
          trainScheduleIDsToModify && (
            <button
              className="btn btn-warning"
              type="button"
              onClick={() =>
                submitConfUpdateTrainSchedules(
                  dispatch,
                  t,
                  setIsWorking,
                  trainScheduleIDsToModify,
                  setDisplayTrainScheduleManagement
                )
              }
            >
              <span className="mr-2">
                <FaPen />
              </span>
              {t('updateTrainSchedule')}
            </button>
          )}

        {displayTrainScheduleManagement === MANAGE_TRAIN_SCHEDULE_TYPES.add && (
          <>
            {isWorking ? (
              <button className="btn btn-primary disabled mb-2" type="button">
                <DotsLoader />
              </button>
            ) : (
              <SubmitConfAddTrainSchedule infraState={infraState} setIsWorking={setIsWorking} />
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
