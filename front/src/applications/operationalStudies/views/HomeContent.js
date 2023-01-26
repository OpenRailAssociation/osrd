import React, { useContext, useEffect, useState } from 'react';
import NavBarSNCF from 'common/BootstrapSNCF/NavBarSNCF';
import logo from 'assets/pictures/views/projects.svg';
import { projectsListJSON } from 'applications/operationalStudies/components/Helpers/genFakeDataForProjects';
import AddAndEditProjectModal from 'applications/operationalStudies/components/Project/AddAndEditProjectModal';
import ProjectCard from 'applications/operationalStudies/components/HomeContent/ProjectCard';
import { useTranslation } from 'react-i18next';
import nextId from 'react-id-generator';
import InputSNCF from 'common/BootstrapSNCF/InputSNCF';
import OptionsSNCF from 'common/BootstrapSNCF/OptionsSNCF';
import osrdLogo from 'assets/pictures/osrd.png';
import Loader from 'common/Loader';
import { FaPlus } from 'react-icons/fa';
import { ModalContext } from 'common/BootstrapSNCF/ModalSNCF/ModalProvider';

export default function HomeContent() {
  const { t } = useTranslation('operationalStudies/home');
  const { openModal } = useContext(ModalContext);
  const [projectsList, setProjectsList] = useState();
  const [filter, setFilter] = useState('');
  const [sortOption, setSortOption] = useState('byName');

  const sortOptions = [
    {
      label: t('sortOptions.byName'),
      value: 'byName',
    },
    {
      label: t('sortOptions.byRecentDate'),
      value: 'byRecentDate',
    },
  ];

  const handleSortOptions = (e) => {
    setSortOption(e.target.value);
    console.log(e);
  };

  useEffect(() => {
    setProjectsList(projectsListJSON());
  }, []);

  return (
    <>
      <NavBarSNCF appName={<div className="navbar-breadcrumbs">{t('projects')}</div>} logo={logo} />
      <main className="mastcontainer mastcontainer-no-mastnav">
        <div className="p-3">
          <div className="application-title d-none">
            <img src={osrdLogo} alt="OSRD logo" />
            <h1>Open Source Railway Designer</h1>
          </div>
          <div className="projects-toolbar">
            <div className="h1 mb-0">
              {t('projectsCount', { count: projectsList ? projectsList.length : 0 })}
            </div>
            <div className="flex-grow-1">
              <InputSNCF
                type="text"
                id="projects-filter"
                name="projects-filter"
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                placeholder={t('filterPlaceholder')}
                whiteBG
                noMargin
                unit={<i className="icons-search" />}
              />
            </div>
            <OptionsSNCF
              name="projects-sort-filter"
              onChange={handleSortOptions}
              selectedValue={sortOption}
              options={sortOptions}
            />
            <button
              className="btn btn-primary"
              type="button"
              onClick={() => openModal(<AddAndEditProjectModal />, 'lg')}
            >
              <FaPlus />
              <span className="ml-2">{t('createProject')}</span>
            </button>
          </div>
          {projectsList ? (
            <div className="projects-list">
              <div className="row">
                {projectsList.map((details) => (
                  <div className="col-lg-3 col-md-4 col-sm-6" key={nextId()}>
                    <ProjectCard details={details} />
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="mt-5">
              <Loader position="center" />
            </div>
          )}
        </div>
      </main>
    </>
  );
}
