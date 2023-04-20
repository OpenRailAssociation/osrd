import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { RiCalendarLine, RiFoldersLine } from 'react-icons/ri';
import { LazyLoadImage } from 'react-lazy-load-image-component';
import { useNavigate } from 'react-router-dom';
import { AiFillFolderOpen } from 'react-icons/ai';
import nextId from 'react-id-generator';
import { dateTimeFrenchFormatting } from 'utils/date';
import { useDispatch } from 'react-redux';
import { updateProjectID, updateScenarioID, updateStudyID } from 'reducers/osrdconf';
import { ProjectResult } from 'common/api/osrdEditoastApi';
import { getDocument } from 'common/api/documentApi';

type Props = {
  setFilterChips: (filterChips: string) => void;
  project: ProjectResult;
};

export default function ProjectCard({ setFilterChips, project }: Props) {
  const { t } = useTranslation('operationalStudies/home');
  const [imageUrl, setImageUrl] = useState<string>();
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const handleClick = () => {
    dispatch(updateProjectID(project.id));
    dispatch(updateStudyID(undefined));
    dispatch(updateScenarioID(undefined));
    navigate('/operational-studies/project');
  };

  // as the image is stored in the database and can be fetched only through api (authentication needed),
  // the direct url can not be given to the <img /> directly. Thus the image is fetched, and a new
  // url is generated and stored in imageUrl (then used in <img />).
  const getProjectImage = async (imageKey: number) => {
    try {
      const image = await getDocument(imageKey);
      setImageUrl(URL.createObjectURL(image));
    } catch (error: unknown) {
      console.error(error);
    }
  };

  useEffect(() => {
    if (project.image) {
      getProjectImage(project.image);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="projects-list-project-card" data-testid={project.name}>
      <div className="projects-list-project-card-img">
        <LazyLoadImage src={imageUrl} alt="project logo" />
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
          {project.last_modification &&
            dateTimeFrenchFormatting(new Date(project.last_modification))}
        </div>
        <div>
          <span className="mr-1">
            <RiFoldersLine />
          </span>
          {t('studiesCount', { count: project.studies_count })}
        </div>
      </div>
      <div className="projects-list-project-card-name">{project.name}</div>
      <div className="projects-list-project-card-description">{project.description}</div>
      <div className="projects-list-project-card-tags">
        {project.tags &&
          project.tags.length > 0 &&
          project.tags?.map((tag) => (
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
