import { ChevronRight } from '@osrd-project/ui-icons';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';

import type { Project, Study, Scenario } from 'common/api/osrdEditoastApi';

type Props = {
  project?: Project;
  study?: Study;
  scenario?: Scenario;
};

export default function BreadCrumbs({ project, study, scenario }: Props) {
  const { t } = useTranslation('operational-studies');
  return (
    <div className="navbar-breadcrumbs">
      {!project && !study && !scenario ? (
        t('project.projects')
      ) : (
        <>
          <div>
            <Link to="/operational-studies/projects">{t('project.projects')}</Link>{' '}
          </div>
          <span className="text-muted">
            <ChevronRight />
          </span>
        </>
      )}

      {project && !study && !scenario && <div className="text-truncate">{project.name}</div>}

      {project && study && (
        <>
          <div className="text-truncate" title={project.name}>
            <Link to={`/operational-studies/projects/${project.id}`}> {project.name}</Link>
          </div>
          <span className="text-muted">
            <ChevronRight />
          </span>
        </>
      )}
      {project && study && !scenario && (
        <div className="text-truncate" title={study.name}>
          {study.name}
        </div>
      )}

      {project && study && scenario && (
        <>
          <div className="text-truncate" title={study.name}>
            <Link to={`/operational-studies/projects/${project.id}/studies/${study.id}`}>
              {study.name}
            </Link>
          </div>
          <span className="text-muted">
            <ChevronRight />
          </span>
          <div className="text-truncate" title={scenario.name}>
            {scenario.name}
          </div>
        </>
      )}
    </div>
  );
}
