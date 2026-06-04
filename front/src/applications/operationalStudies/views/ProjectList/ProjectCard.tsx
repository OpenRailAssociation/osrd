import { Calendar, CheckCircle, FileDirectory, FileDirectoryOpen } from '@osrd-project/ui-icons';
import cx from 'classnames';
import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';
import { Link } from 'react-router-dom';

import type { ProjectWithStudies, SearchResultItemProject } from 'common/api/osrdEditoastApi';
import { getUserSafeWord } from 'reducers/user/userSelectors';
import { useDateTimeLocale } from 'utils/date';
import { useProjectImage } from 'utils/hooks/useProjectImage';

type Props = {
  setFilterChips: (filterChips: string) => void;
  project: ProjectWithStudies | SearchResultItemProject;
  isSelected: boolean;
  toggleSelect: (id: number) => void;
};

export default function ProjectCard({ setFilterChips, project, isSelected, toggleSelect }: Props) {
  const { t } = useTranslation('operational-studies');
  const dateTimeLocale = useDateTimeLocale();
  const safeWord = useSelector(getUserSafeWord);

  const imageUrl = useProjectImage(project.image);

  return (
    <div
      className={cx('project-card', isSelected && 'selected')}
      data-testid={project.name}
      onClick={() => toggleSelect(project.id)}
      role="button"
      tabIndex={0}
    >
      <span className="selected-mark">
        <CheckCircle variant="fill" size="lg" />
      </span>
      <div className="project-card-img">
        <img src={imageUrl} alt="project logo" loading="lazy" />
        <div className="buttons">
          <Link to={`/operational-studies/projects/${project.id}`}>
            <button
              data-testid="openProject"
              className="btn btn-primary btn-sm ml-auto"
              type="button"
            >
              <span className="mr-2">{t('operational-studies-management.open')}</span>
              <FileDirectoryOpen variant="fill" />
            </button>
          </Link>
        </div>
      </div>
      <div className="project-card-studies">
        <div>
          <span className="mr-1">
            <Calendar />
          </span>
          {new Date(project.last_modification).toLocaleString(dateTimeLocale, {
            dateStyle: 'medium',
          })}
        </div>
        <div>
          <span className="mr-1">
            <FileDirectory />
          </span>
          {t('study.count', { count: project.studies_count })}
        </div>
      </div>
      <div className="project-card-name">{project.name}</div>
      <div className="project-card-description">{project.description}</div>
      {project.tags.length > 0 && (
        <div className="project-card-tags">
          {project.tags
            .filter((tag) => tag !== safeWord)
            .map((tag) => (
              <div
                className="project-card-tags-tag"
                key={tag}
                role="button"
                tabIndex={0}
                onClick={() => setFilterChips(tag)}
                title={tag}
              >
                {tag}
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
