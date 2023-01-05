import React from 'react';
import NavBarSNCF from 'common/BootstrapSNCF/NavBarSNCF';
import logo from 'assets/pictures/views/projects.svg';
import genJSON from 'applications/osrd/components/HomeContent/genJSON';
import ProjectCard from 'applications/osrd/components/HomeContent/ProjectCard';
import { useTranslation } from 'react-i18next';
import nextId from 'react-id-generator';

export default function HomeContent() {
  const { t } = useTranslation('osrd/home');
  const json = genJSON();
  console.log(json);

  return (
    <>
      <NavBarSNCF appName={t('projects')} logo={logo} />
      <main className="mastcontainer mastcontainer-no-mastnav">
        <div className="p-3">
          <div className="projects-list">
            <div className="row">
              {json.map((details) => (
                <div className="col-xl-2 col-lg-3 col-md-4 col-sm-6">
                  <ProjectCard details={details} key={nextId()} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>
    </>
  );
}
