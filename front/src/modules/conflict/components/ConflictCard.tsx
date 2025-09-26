import { useRef, useState } from 'react';

import { useTranslation } from 'react-i18next';

import OSRDTooltip from 'common/OSRDTooltip';
import { useSubCategoryContext } from 'common/SubCategoryContext';
import isMainCategory from 'modules/rollingStock/helpers/category';
import { useDateTimeLocale } from 'utils/date';

import type { ConflictWithTrainNames } from '../types';
import { getTrainCategoryClassName } from './../../../applications/operationalStudies/views/Scenario/components/Timetable/utils';

const ConflictCard = ({ conflict }: { conflict: ConflictWithTrainNames }) => {
  const { t } = useTranslation('operational-studies', { keyPrefix: 'main' });
  const dateTimeLocale = useDateTimeLocale();
  const start_time = new Date(conflict.start_time).toLocaleTimeString(dateTimeLocale);
  const end_time = new Date(conflict.end_time).toLocaleTimeString(dateTimeLocale);
  const start_date = new Date(conflict.start_time).toLocaleDateString(dateTimeLocale);
  const totalTrains = conflict.trainsData.length;
  const showOthers = totalTrains > 4;
  const maxVisibleTrainTags = showOthers ? 3 : totalTrains;
  const [isOthersTooltipOpen, setIsOthersTooltipOpen] = useState(false);
  const trainsContainerRef = useRef<HTMLDivElement>(null);
  const othersTagRef = useRef<HTMLDivElement>(null);

  const subCategories = useSubCategoryContext();

  return (
    <div className="conflict-card">
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

      <div className="trains-name" ref={trainsContainerRef}>
        {conflict.trainsData.map((train, idx) => {
          if (idx >= maxVisibleTrainTags) return null;
          const category = train.category;

          const currentSubCategory =
            category && !isMainCategory(category)
              ? subCategories?.find((opt) => opt.code === category.sub_category_code)
              : null;

          return (
            <div
              key={`train-${idx}-${train.name}`}
              className={`train-name-card ${getTrainCategoryClassName(category, 'text')}`}
              style={{
                color: currentSubCategory?.color,
              }}
              title={train.name}
            >
              <span>{train.name}</span>
            </div>
          );
        })}
        {/* Show the "Others" card if there are more than 4 trains */}
        {showOthers && (
          <>
            <div
              ref={othersTagRef}
              className="train-name-card train-category-text-None other-trains"
              onMouseEnter={() => setIsOthersTooltipOpen(true)}
              onMouseLeave={() => setIsOthersTooltipOpen(false)}
            >
              <span>
                {t('conflicts.otherTrains', {
                  count: conflict.trainsData.length - 3,
                })}
              </span>
            </div>

            {isOthersTooltipOpen && (
              <OSRDTooltip
                containerRef={othersTagRef}
                header={t('conflicts.trainsInConflictTitle')}
                items={conflict.trainsData
                  .filter((_, index) => index >= 3)
                  .map((train) => train.name)}
                offsetRatio={{ top: 1.2 }}
                reverseIfOverflow
              />
            )}
          </>
        )}
      </div>

      <div className="conflict-separator" />
      <div className="conflict-separator-bottom" />
    </div>
  );
};

export default ConflictCard;
