import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import 'dayjs/locale/fr';
import { RiFolderChartLine } from 'react-icons/ri';
import infraLogo from 'assets/pictures/components/tracks.svg';

dayjs.locale('fr');

type Props = {
  details: {
    id: string;
    name: string;
    description: string;
    creationDate: Date;
    lastModifiedDate: Date;
    infra_name: string;
  };
};

export default function StudyCard({ details }: Props) {
  const { t } = useTranslation('osrd/study');
  const navigate = useNavigate();

  const handleClick = () => {
    console.log('redirect to scenario');
    navigate('/osrd/scenario');
  };

  return (
    <div className="scenarios-list-card">
      <div className="scenarios-list-card-name">
        <span className="mr-2">
          <RiFolderChartLine />
        </span>
        {details.name}
      </div>
      <div className="scenarios-list-card-description">{details.description}</div>
      <div className="scenarios-list-card-footer">
        <div className="scenarios-list-card-infra">
          <img src={infraLogo} alt="infra logo" />
          {details.infra_name}
        </div>
        <div className="scenarios-list-card-date">
          <span className="mr-1">{t('modifiedOn')}</span>
          {dayjs(details.lastModifiedDate).format('D MMM YYYY HH:mm').replace(/\./gi, '')}
        </div>
      </div>
    </div>
  );
}
