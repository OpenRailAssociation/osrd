import { Checkbox } from '@osrd-project/ui-core';
import { Calendar, FileDirectory } from '@osrd-project/ui-icons';
import cx from 'classnames';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import type { StudyCardDetails } from 'applications/operationalStudies/types';
import { useDateTimeLocale } from 'utils/date';
import { budgetFormat } from 'utils/numbers';

type StudyCardProps = {
  setFilterChips: (filterChips: string) => void;
  study: StudyCardDetails;
  isSelected: boolean;
  toggleSelect: (id: number) => void;
};

export default function StudyCard({
  setFilterChips,
  study,
  isSelected,
  toggleSelect,
}: StudyCardProps) {
  const { t } = useTranslation('operational-studies');
  const dateTimeLocale = useDateTimeLocale();

  return (
    <Link
      to={`studies/${study.id}`}
      className={cx('study-card', { selected: isSelected })}
      data-testid={study.name}
    >
      <div className="study-card-name">
        <span className="study-card-name-text" title={study.name}>
          {study.name}
        </span>
        {/* oxlint-disable-next-line jsx-a11y/no-static-element-interactions -- This feature will disappear soon enough */}
        <div className="study-card-select" onClick={(e) => e.stopPropagation()}>
          <Checkbox checked={isSelected} onChange={() => toggleSelect(study.id)} />
        </div>
      </div>
      {study.study_type && (
        <div className="study-card-type">{t(`study.studyCategories.${study.study_type}`)}</div>
      )}
      <div className="study-card-description">{study.description}</div>

      {(study.budget || study.service_code || study.business_code) && (
        <div className="study-card-financials">
          <div className="study-card-financials-infos">
            {study.service_code && (
              <div className="study-card-financials-infos-item">
                <h3>{t('study.study-service-code')}</h3>
                <div>{study.service_code}</div>
              </div>
            )}
            {study.business_code && (
              <div className="study-card-financials-infos-item">
                <h3>{t('study.study-business-code')}</h3>
                <div>{study.business_code}</div>
              </div>
            )}
          </div>
          {study.budget ? (
            <div className="study-card-financials-amount">
              <span className="study-card-financials-amount-text">{t('study.budget')}</span>
              {budgetFormat(study.budget)}
            </div>
          ) : null}
        </div>
      )}

      {study.tags.length > 0 && (
        <div className="study-card-tags">
          {study.tags.map((tag) => (
            <div
              className="study-card-tags-tag"
              key={tag}
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setFilterChips(tag);
              }}
              title={tag}
            >
              {tag}
            </div>
          ))}
        </div>
      )}

      <div className="study-card-footer">
        <div className="study-card-scenarios-count ml-auto">
          <span className="mr-1">
            <FileDirectory />
          </span>
          {t('scenario.count', { count: study.scenarios_count })}
        </div>
        <div className="study-card-date">
          <span className="mr-1">
            <Calendar />
          </span>
          <span className="mr-1">{t('study.updatedOn')}</span>
          {study.last_modification &&
            new Date(study.last_modification).toLocaleString(dateTimeLocale, {
              dateStyle: 'medium',
            })}
        </div>
      </div>
    </Link>
  );
}
