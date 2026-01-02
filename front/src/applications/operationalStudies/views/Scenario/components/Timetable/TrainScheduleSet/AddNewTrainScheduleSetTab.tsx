import { PlusCircle } from '@osrd-project/ui-icons';
import { useTranslation } from 'react-i18next';

const AddNewTrainScheduleSetTab = () => {
  const { t } = useTranslation('operational-studies', {
    keyPrefix: 'main.timetable.trainScheduleSets',
  });

  return (
    <div className="train-schedule-set-tab-container add-tab-container">
      <div
        className="train-schedule-set-tab add-tab"
        role="button"
        tabIndex={0}
        title={t('newTrainScheduleSet')}
        onClick={() => {}}
      >
        <PlusCircle />
        <span>{t('newTrainScheduleSet')}</span>
      </div>
    </div>
  );
};

export default AddNewTrainScheduleSetTab;
