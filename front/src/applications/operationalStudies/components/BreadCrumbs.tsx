import React from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

type Props = {
  projectName?: string;
  studyName?: string;
  scenarioName?: string;
};

export default function BreadCrumbs({ projectName, studyName, scenarioName }: Props) {
  const { t } = useTranslation('operationalStudies/project');
  return (
    <div className="navbar-breadcrumbs">
      {!projectName && !studyName && !scenarioName ? (
        t('projectsList')
      ) : (
        <>
          <Link to="/operational-studies">{t('projectsList')}</Link>
          <i className="icons-arrow-next icons-size-x75 text-muted" />
        </>
      )}

      {projectName && !studyName && !scenarioName && projectName}

      {projectName && studyName && (
        <>
          <Link to="/operational-studies/project">{projectName}</Link>
          <i className="icons-arrow-next icons-size-x75 text-muted" />
        </>
      )}
      {projectName && studyName && !scenarioName && studyName}

      {projectName && studyName && scenarioName && (
        <>
          <Link to="/operational-studies/study">{studyName}</Link>
          <i className="icons-arrow-next icons-size-x75 text-muted" />
          {scenarioName}
        </>
      )}
    </div>
  );
}
