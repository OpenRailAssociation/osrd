import dayjs from 'dayjs';
import { useTranslation } from 'react-i18next';

import { TRAIN_MAIN_CATEGORY_CLASS } from 'modules/timetableItem/components/Timetable/consts';

import type { ConflictWithTrainNames } from '../types';

const formatToLocalTime = (dateString: string) => dayjs.utc(dateString).local().format('HH:mm:ss');

const ConflictCard = ({
  conflict,
  onConflictClick,
}: {
  conflict: ConflictWithTrainNames;
  onConflictClick: (conflict: ConflictWithTrainNames) => void;
}) => {
  const { t } = useTranslation('operational-studies', { keyPrefix: 'main' });
  const start_time = formatToLocalTime(conflict.start_time);
  const end_time = formatToLocalTime(conflict.end_time);
  const start_date = dayjs(conflict.start_time).format('DD/MM/YYYY');

  return (
    <div
      className="conflict-card"
      onClick={() => onConflictClick(conflict)}
      role="button"
      tabIndex={0}
    >
      <div className="conflict-info">
        <div className="conflict-type">{t(conflict.conflict_type)}</div>
        <div className="start-and-end-time">
          <div className="start-time" title={start_time}>
            {start_time}
          </div>
          <div className="end-time" title={end_time}>
            {end_time}
          </div>
        </div>
        <div className="departure-date" title={start_date}>
          {start_date}
        </div>
      </div>

      <div className="trains-name" title={conflict.trainNames.join(', ')}>
        {conflict.trainNames.map((trainName, idx) => {
          const category = conflict.trainCategories[idx];
          const categoryClass = category
            ? TRAIN_MAIN_CATEGORY_CLASS[category]
            : TRAIN_MAIN_CATEGORY_CLASS.None;

          return (
            <div
              key={`train-${idx}-${trainName}`}
              className={`train-name-card train-category-text-${categoryClass}`}
              title={trainName}
            >
              <span>{trainName}</span>
            </div>
          );
        })}
      </div>

      <div className="conflict-separator" />
      <div className="conflict-separator-bottom" />
    </div>
  );
};

export default ConflictCard;
