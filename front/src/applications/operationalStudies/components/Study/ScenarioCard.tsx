import React from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { RiFolderChartLine } from 'react-icons/ri';
import infraLogo from 'assets/pictures/components/tracks.svg';
import { AiFillFolderOpen } from 'react-icons/ai';
import { dateTimeFrenchFormatting } from 'utils/date';
import { useDispatch } from 'react-redux';
import { updateScenarioID } from 'reducers/osrdconf';
import { updateSelectedProjection } from 'reducers/osrdsimulation/actions';
import { FcCalendar } from 'react-icons/fc';
import { MdTrain } from 'react-icons/md';
import nextId from 'react-id-generator';

type Props = {
  details: {
    id: number;
    name: string;
    description: string;
    creation_date: Date;
    last_modification: Date;
    infra_name: string;
    trains_count: number;
    tags: Array<1>;
  };
};

export default function StudyCard({ details }: Props) {
  const { t } = useTranslation('operationalStudies/study');
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const handleClick = () => {
    dispatch(updateScenarioID(details.id));
    dispatch(updateSelectedProjection(undefined));
    navigate('/operational-studies/scenario');
  };

  return (
    <div className="scenarios-list-card">
      <div className="scenarios-list-card-name">
        <span className="mr-2">
          <RiFolderChartLine />
        </span>
        {details.name}
        <button className="btn btn-sm" type="button" onClick={handleClick}>
          <span className="mr-2">{t('openScenario')}</span>
          <AiFillFolderOpen />
        </button>
      </div>
      <div className="scenarios-list-card-description">{details.description}</div>

      <div className="scenarios-list-card-tags">
        {details.tags.map((tag) => (
          <div className="scenarios-list-card-tags-tag" key={nextId()}>
            {tag}
          </div>
        ))}
      </div>
      <div className="scenarios-list-card-footer">
        <div className="scenarios-list-card-infra">
          <img src={infraLogo} alt="infra logo" />
          {details.infra_name}
        </div>
        <div className="scenarios-list-card-trains-count ml-auto">
          <span className="mr-1">
            <MdTrain />
          </span>
          {details.trains_count}
        </div>
        <div className="scenarios-list-card-date">
          <span className="mr-1">
            <FcCalendar />
          </span>
          <span className="mr-1">{t('modifiedOn')}</span>
          {dateTimeFrenchFormatting(details.last_modification)}
        </div>
      </div>
    </div>
  );
}
