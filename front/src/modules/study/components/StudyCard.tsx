import React from 'react';

import { Calendar, FileDirectory, FileDirectoryOpen } from '@osrd-project/ui-icons';
import { useTranslation } from 'react-i18next';
import nextId from 'react-id-generator';
import { useNavigate } from 'react-router-dom';

import studyLogo from 'assets/pictures/views/study.svg';
import type { StudyWithScenarios } from 'common/api/osrdEditoastApi';
import { useOsrdConfActions } from 'common/osrdContext';
import { useAppDispatch } from 'store';
import { dateTimeFormatting } from 'utils/date';
import { budgetFormat } from 'utils/numbers';

type StudyCardProps = {
  setFilterChips: (filterChips: string) => void;
  study: StudyWithScenarios;
};

export default function StudyCard({ setFilterChips, study }: StudyCardProps) {
  const { t } = useTranslation(['operationalStudies/project', 'operationalStudies/study']);
  const navigate = useNavigate();
  const dispatch = useAppDispatch();
  const { updateScenarioID, updateStudyID } = useOsrdConfActions();

  const handleClick = () => {
    dispatch(updateStudyID(study.id));
    dispatch(updateScenarioID(undefined));
    navigate(`studies/${study.id}`);
  };
  return (
    <div className="study-card">
      <div className="study-card-name" data-testid={study.name}>
        <span className="mr-2">
          <img className="study-card-img" src={studyLogo} alt="study logo" />
        </span>
        <span className="study-card-name-text" title={study.name}>
          {study.name}
        </span>
        <button
          data-testid="openStudy"
          className="btn btn-primary btn-sm"
          onClick={handleClick}
          type="button"
        >
          <span className="mr-2">{t('openStudy')}</span>
          <FileDirectoryOpen variant="fill" />
        </button>
      </div>
      {study.study_type && (
        <div className="study-card-type">
          {t(`operationalStudies/study:studyCategories.${study.study_type}`)}
        </div>
      )}
      <div className="study-card-description">{study.description}</div>

      {(study.budget !== 0 || study.service_code || study.business_code) && (
        <div className="study-card-financials">
          <div className="study-card-financials-infos">
            {study.service_code && (
              <div className="study-card-financials-infos-item">
                <h3>{t('geremiCode')}</h3>
                <div>{study.service_code}</div>
              </div>
            )}
            {study.business_code && (
              <div className="study-card-financials-infos-item">
                <h3>{t('affairCode')}</h3>
                <div>{study.business_code}</div>
              </div>
            )}
          </div>
          {study.budget ? (
            <div className="study-card-financials-amount">
              <span className="study-card-financials-amount-text">{t('budget')}</span>
              {budgetFormat(study.budget)}
            </div>
          ) : null}
        </div>
      )}

      <div className="study-card-tags">
        {study.tags &&
          study.tags.length > 0 &&
          study.tags.map((tag) => (
            <div
              className="study-card-tags-tag"
              key={nextId()}
              role="button"
              tabIndex={0}
              onClick={() => setFilterChips(tag)}
              title={tag}
            >
              {tag}
            </div>
          ))}
      </div>

      <div className="study-card-footer">
        <div className="study-card-scenarios-count ml-auto">
          <span className="mr-1">
            <FileDirectory />
          </span>
          {t('scenariosCount', { count: study.scenarios_count })}
        </div>
        <div className="study-card-date">
          <span className="mr-1">
            <Calendar />
          </span>
          <span className="mr-1">{t('updatedOn')}</span>
          {dateTimeFormatting(study.last_modification)}
        </div>
      </div>
    </div>
  );
}
