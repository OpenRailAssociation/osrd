import { Checkbox } from '@osrd-project/ui-core';
import { Calendar, FileDirectory } from '@osrd-project/ui-icons';
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
    <Link
      to={`/operational-studies/projects/${project.id}`}
      className={cx('project-card', isSelected && 'selected')}
      data-testid={project.name}
    >
      <div className="project-card-img">
        <img src={imageUrl} alt="project logo" loading="lazy" />
        {/* oxlint-disable-next-line jsx-a11y/no-static-element-interactions -- This feature will disappear soon enough */}
        <div className="project-card-select" onClick={(e) => e.stopPropagation()}>
          <Checkbox checked={isSelected} onChange={() => toggleSelect(project.id)} />
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
    </Link>
  );
}
