import React from 'react';
import { FaDownload, FaPen, FaPlus } from 'react-icons/fa';
import { MANAGE_TRAIN_SCHEDULE_TYPES } from 'applications/operationalStudies/consts';
import { useTranslation } from 'react-i18next';
import { updateTrainScheduleIDsToModify } from 'reducers/osrdconf';
import { useDispatch } from 'react-redux';

type Props = {
  displayTrainScheduleManagement: string;
  setDisplayTrainScheduleManagement: (type: string) => void;
};

export default function TimetableManageTrainSchedule({
  displayTrainScheduleManagement,
  setDisplayTrainScheduleManagement,
}: Props) {
  const { t } = useTranslation('operationalStudies/manageTrainSchedule');
  const dispatch = useDispatch();

  const leaveManageTrainSchedule = () => {
    setDisplayTrainScheduleManagement(MANAGE_TRAIN_SCHEDULE_TYPES.none);
    dispatch(updateTrainScheduleIDsToModify(undefined));
  };

  const textContent = () => {
    if (displayTrainScheduleManagement === MANAGE_TRAIN_SCHEDULE_TYPES.add) {
      return (
        <>
          <span className="text-primary">
            <FaPlus />
          </span>
          <span className="text-center">{t('addTrainSchedule')}</span>
        </>
      );
    }
    if (displayTrainScheduleManagement === MANAGE_TRAIN_SCHEDULE_TYPES.edit) {
      return (
        <>
          <span className="text-orange">
            <FaPen />
          </span>
          <span className="text-center flex-grow-1">{t('updateTrainSchedule')}</span>
        </>
      );
    }
    if (displayTrainScheduleManagement === MANAGE_TRAIN_SCHEDULE_TYPES.import) {
      return (
        <>
          <span className="text-secondary">
            <FaDownload />
          </span>
          <span className="text-center flex-grow-1">{t('importTrainSchedule')}</span>
        </>
      );
    }
    return null;
  };

  return (
    <div
      className="scenario-timetable-managetrainschedule"
      role="button"
      tabIndex={0}
      onClick={leaveManageTrainSchedule}
    >
      <div className="scenario-timetable-managetrainschedule-header">
        <div className="d-flex gap-1 align-items-center justify-content-center mb-2 p-4 bg-white rounded h-100">
          {textContent()}
        </div>
        {displayTrainScheduleManagement === MANAGE_TRAIN_SCHEDULE_TYPES.edit && (
          <button className="btn btn-warning mb-2" type="button">
            <span className="mr-2">
              <FaPen />
            </span>
            {t('updateTrainSchedule')}
          </button>
        )}
        {displayTrainScheduleManagement === MANAGE_TRAIN_SCHEDULE_TYPES.add && (
          <button className="btn btn-primary mb-2" type="button">
            <span className="mr-2">
              <FaPlus />
            </span>
            {t('addTrainSchedule')}
          </button>
        )}
        <button
          className="btn btn-secondary btn-block"
          type="button"
          onClick={() => setDisplayTrainScheduleManagement(MANAGE_TRAIN_SCHEDULE_TYPES.none)}
        >
          <i className="icons-arrow-prev mr-2" />
          {t('returnToSimulationResults')}
        </button>
      </div>
      <div className="scenario-timetable-managetrainschedule-body" />
    </div>
  );
}
