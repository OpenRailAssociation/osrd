import React from 'react';
import { useTranslation } from 'react-i18next';
import { RiCalendarLine, RiFoldersLine } from 'react-icons/ri';
import { LazyLoadImage } from 'react-lazy-load-image-component';
import { useNavigate } from 'react-router-dom';
import dayjs from 'dayjs';
import 'dayjs/locale/fr';
import { AiFillFolderOpen } from 'react-icons/ai';
import nextId from 'react-id-generator';

dayjs.locale('fr');

type Props = {
  details: {
    name: string;
    description: string;
    image: string;
    lastModified: Date;
    studies: Array<1>;
    tags: Array<1>;
  };
};

export default function ProjectCard({ details }: Props) {
  const { t } = useTranslation('osrd/home');
  const navigate = useNavigate();

  const handleClick = () => {
    console.log('redirect to project');
    navigate('/osrd/project');
  };

  return (
    <div className="projects-list-project-card">
      <div className="projects-list-project-card-img">
        <LazyLoadImage src={details.image} alt="project logo" />
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
          {dayjs(details.lastModified).format('ddd D MMM YYYY, HH:mm').replace('.', '')}
        </div>
        <div>
          <span className="mr-1">
            <RiFoldersLine />
          </span>
          {`${details.studies.length} ${t('studiesCount')}`}
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
