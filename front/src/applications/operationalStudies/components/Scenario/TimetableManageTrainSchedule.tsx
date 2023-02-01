import React, { useState } from 'react';
import { FaPlus } from 'react-icons/fa';
import { MANAGE_TRAIN_SCHEDULE_TYPES } from 'applications/operationalStudies/consts';
import { useTranslation } from 'react-i18next';
import InfraSelector from 'common/InfraSelector/InfraSelector';
import TimetableSelector from '../ManageTrainSchedule/TimetableSelector';

type Props = {
  setDisplayTrainScheduleManagement: (type: string) => void;
};

export default function TimetableManageTrainSchedule({ setDisplayTrainScheduleManagement }: Props) {
  const { t } = useTranslation('operationalStudies/manageTrainSchedule');
  const [mustUpdateTimetable, setMustUpdateTimetable] = useState(false);

  return (
    <div className="scenario-timetable-managetrainschedule">
      <div className="scenario-timetable-managetrainschedule-header">
        <div className="text-center mb-3">
          <span className="text-primary mr-2">
            <FaPlus />
          </span>
          {t('addTrainSchedule')}
        </div>
        <button
          className="btn btn-secondary btn-block"
          type="button"
          onClick={() => setDisplayTrainScheduleManagement(MANAGE_TRAIN_SCHEDULE_TYPES.none)}
        >
          {t('cancelAddTrainSchedule')}
        </button>
      </div>
      <div className="scenario-timetable-managetrainschedule-body">
        <InfraSelector />
        <TimetableSelector
          mustUpdateTimetable={mustUpdateTimetable}
          setMustUpdateTimetable={setMustUpdateTimetable}
        />
      </div>
    </div>
  );
}
