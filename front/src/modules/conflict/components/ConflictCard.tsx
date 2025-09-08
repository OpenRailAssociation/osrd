import { useTranslation } from 'react-i18next';

import { getTrainCategoryClassName } from 'applications/operationalStudies/views/Scenario/components/Timetable/utils';
import { useSubCategoryContext } from 'common/SubCategoryContext';
import isMainCategory from 'modules/rollingStock/helpers/category';
import { useDateTimeLocale } from 'utils/date';

import type { ConflictWithTrainNames } from '../types';

const ConflictCard = ({
  conflict,
  onConflictClick,
}: {
  conflict: ConflictWithTrainNames;
  onConflictClick: (conflict: ConflictWithTrainNames) => void;
}) => {
  const { t } = useTranslation('operational-studies', { keyPrefix: 'main' });
  const dateTimeLocale = useDateTimeLocale();
  const start_time = new Date(conflict.start_time).toLocaleTimeString(dateTimeLocale);
  const end_time = new Date(conflict.end_time).toLocaleTimeString(dateTimeLocale);
  const start_date = new Date(conflict.start_time).toLocaleDateString(dateTimeLocale);

  const subCategories = useSubCategoryContext();

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

          const currentSubCategory =
            category && !isMainCategory(category)
              ? subCategories?.find((opt) => opt.code === category.sub_category_code)
              : null;

          return (
            <div
              key={`train-${idx}-${trainName}`}
              className={`train-name-card ${getTrainCategoryClassName(category, 'text')}`}
              style={{
                color: currentSubCategory?.color,
              }}
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
