import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Project, Study, Scenario } from 'common/api/osrdEditoastApi';

type Props = {
  project?: Project;
  study?: Study;
  scenario?: Scenario;
};

export default function BreadCrumbs({ project, study, scenario }: Props) {
  const { t } = useTranslation('operationalStudies/project');
  return (
    <div className="navbar-breadcrumbs">
      {!project && !study && !scenario ? (
        t('projectsList')
      ) : (
        <>
          <div>
            <Link to="/operational-studies/projects">{t('projectsList')}</Link>{' '}
          </div>
          <i className="icons-arrow-next icons-size-x75 text-muted" />
        </>
      )}

      {project && !study && !scenario && <div className="text-truncate">{project.name}</div>}

      {project && study && (
        <>
          <div className="text-truncate" title={project.name}>
            <Link to={`/operational-studies/projects/${project.id}`}> {project.name}</Link>
          </div>
          <i className="icons-arrow-next icons-size-x75 text-muted" />
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
          <i className="icons-arrow-next icons-size-x75 text-muted" />
          <div className="text-truncate" title={scenario.name}>
            {scenario.name}
          </div>
        </>
      )}
    </div>
  );
}
