import React from 'react';
import { useTranslation } from 'react-i18next';
import { RiCalendarLine, RiFoldersLine } from 'react-icons/ri';
import { LazyLoadImage } from 'react-lazy-load-image-component';
import { useNavigate } from 'react-router-dom';
import { AiFillFolderOpen } from 'react-icons/ai';
import nextId from 'react-id-generator';
import { dateTimeFrenchFormatting } from 'utils/date';
import { useDispatch } from 'react-redux';
import { updateProjectID } from 'reducers/osrdconf';
import { getTigerRedPanda } from '../Helpers/genFakeDataForProjects';

type Props = {
  details: {
    id: number;
    name: string;
    description: string;
    image: string;
    last_modification: Date;
    studies: Array<1>;
    tags: Array<1>;
  };
};

export default function ProjectCard({ details }: Props) {
  const { t } = useTranslation('operationalStudies/home');
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const handleClick = () => {
    dispatch(updateProjectID(details.id));
    navigate('/operational-studies/project');
  };

  return (
    <div className="projects-list-project-card">
      <div className="projects-list-project-card-img">
        <LazyLoadImage src={getTigerRedPanda()} alt="project logo" />
        <button className="btn btn-primary btn-sm" onClick={handleClick} type="button">
          <span className="mr-2">{t('openProject')}</span>
          <AiFillFolderOpen />
        </button>
      </div>
      <div className="projects-list-project-card-studies">
        <div>
          <span className="mr-1">
            <RiCalendarLine />
          </span>
          {dateTimeFrenchFormatting(details.last_modification)}
        </div>
        <div>
          <span className="mr-1">
            <RiFoldersLine />
          </span>
          {t('studiesCount', { count: details.studies.length })}
        </div>
      </div>
      <div className="projects-list-project-card-name">{details.name}</div>
      <div className="projects-list-project-card-description">{details.description}</div>
      <div className="projects-list-project-card-tags">
        {details.tags.map((tag) => (
          <div className="projects-list-project-card-tags-tag" key={nextId()}>
            {tag}
          </div>
        ))}
      </div>
    </div>
  );
}
