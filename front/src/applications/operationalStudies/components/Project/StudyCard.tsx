import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import nextId from 'react-id-generator';
import { AiFillFolderOpen } from 'react-icons/ai';
import { FcCalendar } from 'react-icons/fc';
import studyLogo from 'assets/pictures/views/study.svg';
import { budgetFormat } from 'utils/numbers';
import { dateTimeFrenchFormatting } from 'utils/date';
import { useDispatch } from 'react-redux';
import { updateScenarioID, updateStudyID } from 'reducers/osrdconf';
import { RiFolderChartLine } from 'react-icons/ri';
import { StudyResult } from 'common/api/osrdEditoastApi';

type Props = {
  setFilterChips: (filterChips: string) => void;
  study: StudyResult;
};

export default function StudyCard({ setFilterChips, study }: Props) {
  const { t } = useTranslation(['operationalStudies/project', 'operationalStudies/study']);
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const handleClick = () => {
    dispatch(updateStudyID(study.id));
    dispatch(updateScenarioID(undefined));
    navigate('/operational-studies/study');
  };

  return (
    <div className="studies-list-card">
      <div className="studies-list-card-name" data-testid={study.name}>
        <span className="mr-2">
          <img src={studyLogo} alt="study logo" height="24" />
        </span>
        {study.name}
        <button className="btn btn-primary btn-sm" onClick={handleClick} type="button">
          <span className="mr-2">{t('openStudy')}</span>
          <AiFillFolderOpen />
        </button>
      </div>
      <div className="studies-list-card-type">
        {study.study_type ? t(`operationalStudies/study:studyCategories.${study.study_type}`) : ''}
      </div>
      <div className="studies-list-card-description">{study.description}</div>

      <div className="studies-list-card-financials">
        <div className="studies-list-card-financials-infos">
          {study.service_code && (
            <div className="studies-list-card-financials-infos-item">
              <h3>{t('geremiCode')}</h3>
              <div>{study.service_code}</div>
            </div>
          )}
          {study.business_code && (
            <div className="studies-list-card-financials-infos-item">
              <h3>{t('affairCode')}</h3>
              <div>{study.business_code}</div>
            </div>
          )}
        </div>
        {study.budget && study.budget > 0 && (
          <div className="studies-list-card-financials-amount">
            <span className="studies-list-card-financials-amount-text">{t('budget')}</span>
            {budgetFormat(study.budget)}
          </div>
        )}
      </div>

      <div className="studies-list-card-tags">
        {study.tags &&
          study.tags.map((tag) => (
            <div
              className="studies-list-card-tags-tag"
              key={nextId()}
              role="button"
              tabIndex={0}
              onClick={() => setFilterChips(tag)}
            >
              {tag}
            </div>
          ))}
      </div>

      <div className="studies-list-card-footer">
        <div className="studies-list-card-scenarios-count ml-auto">
          <span className="mr-1">
            <RiFolderChartLine />
          </span>
          {t('scenariosCount', { count: study.scenarios?.length })}
        </div>
        <div className="studies-list-card-date">
          <span className="mr-1">
            <FcCalendar />
          </span>
          <span className="mr-1">{t('modifiedOn')}</span>
          {study.last_modification && dateTimeFrenchFormatting(new Date(study.last_modification))}
        </div>
      </div>
    </div>
  );
}
