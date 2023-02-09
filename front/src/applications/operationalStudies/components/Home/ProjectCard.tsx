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

type Props = {
  setFilterChips: (filterChips: string) => void;
  project: {
    id: number;
    name: string;
    description: string;
    image_url: string;
    last_modification: Date;
    studies: Array<1>;
    tags: string[];
  };
};

export default function ProjectCard({ setFilterChips, project }: Props) {
  const { t } = useTranslation('operationalStudies/home');
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const handleClick = () => {
    dispatch(updateProjectID(project.id));
    navigate('/operational-studies/project');
  };

  return (
    <div className="projects-list-project-card">
      <div className="projects-list-project-card-img">
        <LazyLoadImage src={project.image_url} alt="project logo" />
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
          {dateTimeFrenchFormatting(project.last_modification)}
        </div>
        <div>
          <span className="mr-1">
            <RiFoldersLine />
          </span>
          {t('studiesCount', { count: project.studies.length })}
        </div>
      </div>
      <div className="projects-list-project-card-name">{project.name}</div>
      <div className="projects-list-project-card-description">{project.description}</div>
      <div className="projects-list-project-card-tags">
        {project.tags?.map((tag) => (
          <div
            className="projects-list-project-card-tags-tag"
            key={nextId()}
            role="button"
            tabIndex={0}
            onClick={() => setFilterChips(tag)}
          >
            {tag}
          </div>
        ))}
      </div>
    </div>
  );
}
