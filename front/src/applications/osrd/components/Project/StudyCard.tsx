import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import 'dayjs/locale/fr';
import nextId from 'react-id-generator';
import { AiFillFolderOpen } from 'react-icons/ai';
import { RiFoldersLine } from 'react-icons/ri';
import { FcCalendar } from 'react-icons/fc';

dayjs.locale('fr');

type Props = {
  details: {
    id: string;
    name: string;
    description: string;
    geremiCode: string;
    affairCode: string;
    creationDate: Date;
    startDate: Date;
    estimatedEndingDate: Date;
    realEndingDate: Date;
    lastModifiedDate: Date;
    step: string;
    budget: bigint;
    type: string;
    scenarios: Array<1>;
    tags: Array<1>;
  };
};

export default function StudyCard({ details }: Props) {
  const { t } = useTranslation('osrd/project');
  const navigate = useNavigate();

  const handleClick = () => {
    console.log('redirect to study');
    navigate('/osrd/study');
  };

  return (
    <div className="studies-list-card">
      <div className="studies-list-card-name">
        <span className="mr-2">
          <RiFoldersLine />
        </span>
        {details.name}
        <button className="btn btn-primary btn-sm" onClick={handleClick} type="button">
          <span className="mr-2">{t('openStudy')}</span>
          <AiFillFolderOpen />
        </button>
      </div>
      <div className="studies-list-card-type">{details.type}</div>
      <div className="studies-list-card-description">{details.description}</div>

      <div className="studies-list-card-financials">
        <div className="studies-list-card-financials-infos">
          <div className="studies-list-card-financials-infos-item">
            <h3>{t('geremiCode')}</h3>
            <div>{details.geremiCode}</div>
          </div>
          <div className="studies-list-card-financials-infos-item">
            <h3>{t('affairCode')}</h3>
            <div>{details.affairCode}</div>
          </div>
        </div>
        <div className="studies-list-card-financials-amount">
          <span className="studies-list-card-financials-amount-text">{t('budget')}</span>
          {new Intl.NumberFormat('fr-FR', {
            style: 'currency',
            currency: 'EUR',
            maximumSignificantDigits: 2,
          }).format(details.budget)}
        </div>
      </div>

      <div className="studies-list-card-footer">
        <div className="studies-list-card-tags">
          {details.tags.map((tag) => (
            <div className="studies-list-card-tags-tag" key={nextId()}>
              {tag}
            </div>
          ))}
        </div>
        <div className="studies-list-card-date">
          <span className="mr-1">
            <FcCalendar />
          </span>
          <span className="mr-1">{t('modifiedOn')}</span>
          {dayjs(details.lastModifiedDate).format('D MMM YYYY HH:mm').replace(/\./gi, '')}
        </div>
      </div>
    </div>
  );
}
