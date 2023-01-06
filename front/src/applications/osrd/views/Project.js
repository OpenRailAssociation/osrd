import React, { useEffect, useState } from 'react';
import NavBarSNCF from 'common/BootstrapSNCF/NavBarSNCF';
import logo from 'assets/pictures/views/studies.svg';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import nextId from 'react-id-generator';
import { projectJSON } from 'applications/osrd/components/Helpers/genFakeDataForProjects';
import Loader from 'common/Loader';

function BreadCrumbs() {
  const { t } = useTranslation('osrd/project');
  return (
    <div className="navbar-breadcrumbs">
      <Link to="/osrd">{t('projectsList')}</Link>
      <i className="icons-arrow-next icons-size-x75 text-muted" />
      Nom du projet
    </div>
  );
}

export default function Project() {
  const { t } = useTranslation('osrd/project');
  const [projectDetails, setProjectDetails] = useState();

  useEffect(() => {
    setProjectDetails(projectJSON());
  }, []);

  return (
    <>
      <NavBarSNCF appName={<BreadCrumbs />} logo={logo} />
      <main className="mastcontainer mastcontainer-no-mastnav">
        <div className="p-3">
          {projectDetails ? (
            <div className="project-details">
              <div className="project-details-title">
                <div className="project-details-img">
                  <img src={projectDetails.image} alt="project logo" />
                </div>
                <div className="project-details-name">{projectDetails.name}</div>
              </div>
              <div className="project-details-body">
                <div className="row">
                  <div className="col-md-7">
                    <div className="project-details-description">
                      <h3>{t('description')}</h3>
                      {projectDetails.description}
                    </div>
                  </div>
                  <div className="col-md-5">
                    <div className="project-details-objectives">
                      <h3>{t('objectives')}</h3>
                      {projectDetails.objectives}
                    </div>
                  </div>
                </div>
              </div>
              <div className="project-details-financials">
                <div className="project-details-financials-infos">
                  <h3>{t('fundedBy')}</h3>
                  <div>{projectDetails.financials}</div>
                </div>
                <div className="project-details-financials-amount">
                  {projectDetails.budget}
                </div>
              </div>
              <div className="project-details-tags">
                {projectDetails.tags.map((tag) => (
                  <div className="project-details-tags-tag" key={nextId()}>
                    {tag}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <span className="mt-5">
              <Loader position="center" />
            </span>
          )}
        </div>
      </main>
    </>
  );
}
