import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Project, StudyResult, ScenarioResult } from 'common/api/osrdEditoastApi';

type Props = {
  project?: Project;
  study?: StudyResult;
  scenario?: ScenarioResult;
};

export default function BreadCrumbs({ project, study, scenario }: Props) {
  const { t } = useTranslation('operationalStudies/project');
  return (
    <div className="navbar-breadcrumbs">
      {!project && !study && !scenario ? (
        t('projectsList')
      ) : (
        <>
          <Link to="/operational-studies/projects">{t('projectsList')}</Link>
          <i className="icons-arrow-next icons-size-x75 text-muted" />
        </>
      )}

      {project && !study && !scenario && project.name}

      {project && study && (
        <>
          <Link to={`/operational-studies/projects/${project.id}`}>{project.name}</Link>
          <i className="icons-arrow-next icons-size-x75 text-muted" />
        </>
      )}
      {project && study && !scenario && study.name}

      {project && study && scenario && (
        <>
          <Link to={`/operational-studies/projects/${project.id}/studies/${study.id}`}>
            {study.name}
          </Link>
          <i className="icons-arrow-next icons-size-x75 text-muted" />
          {scenario.name}
        </>
      )}
    </div>
  );
}
