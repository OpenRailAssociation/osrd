import React from 'react';
import { useTranslation } from 'react-i18next';
import { VscFileSubmodule } from 'react-icons/vsc';
import { LazyLoadImage } from 'react-lazy-load-image-component';
import { useNavigate } from 'react-router-dom';

type Props = {
  details: {
    name: string;
    description: string;
    image: string;
    studies: Array<1>;
    tags: Array<1>;
  };
};

export default function ProjectCard({ details }: Props) {
  const { t } = useTranslation('osrd/home');
  const navigate = useNavigate();

  const handleClick = () => {
    console.log('redirect to study');
    navigate('/osrd/study');
  };

  return (
    <div className="projects-list-project-card" role="button" onClick={handleClick} tabIndex={0}>
      <div className="projects-list-project-card-img">
        <LazyLoadImage src={details.image} alt="project logo" />
      </div>
      <div className="projects-list-project-card-studies">
        <span className="mr-1">
          <VscFileSubmodule />
        </span>
        {`${details.studies.length} ${t('studiesNumber')}`}
      </div>
      <div className="projects-list-project-card-name">{details.name}</div>
      <div className="projects-list-project-card-description">{details.description}</div>
      <div className="projects-list-project-card-tags">
        {details.tags.map((tag) => (
          <div className="projects-list-project-card-tags-tag">{tag}</div>
        ))}
      </div>
    </div>
  );
}
