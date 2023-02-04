import React, { useContext, useEffect, useMemo, useState } from 'react';
import NavBarSNCF from 'common/BootstrapSNCF/NavBarSNCF';
import logo from 'assets/pictures/views/projects.svg';
import AddOrEditProjectModal from 'applications/operationalStudies/components/Project/AddOrEditProjectModal';
import ProjectCard from 'applications/operationalStudies/components/Home/ProjectCard';
import { useTranslation } from 'react-i18next';
import nextId from 'react-id-generator';
import OptionsSNCF from 'common/BootstrapSNCF/OptionsSNCF';
import osrdLogo from 'assets/pictures/osrd.png';
import Loader from 'common/Loader';
import { FaPlus } from 'react-icons/fa';
import { ModalContext } from 'common/BootstrapSNCF/ModalSNCF/ModalProvider';
import { get } from 'common/requests';
import { PROJECTS_URI } from 'applications/operationalStudies/components/operationalStudiesConsts';
import FilterTextField from 'applications/operationalStudies/components/FilterTextField';

function displayCards(projectsList, setFilterChips) {
  return projectsList ? (
    <div className="projects-list">
      <div className="row">
        {projectsList.map((project) => (
          <div className="col-lg-3 col-md-4 col-sm-6" key={nextId()}>
            <ProjectCard project={project} setFilterChips={setFilterChips} />
          </div>
        ))}
      </div>
    </div>
  ) : (
    <div className="mt-5">
      <Loader position="center" />
    </div>
  );
}

export default function Home() {
  const { t } = useTranslation('operationalStudies/home');
  const { openModal } = useContext(ModalContext);
  const [projectsList, setProjectsList] = useState();
  const [sortOption, setSortOption] = useState('-last_modification');
  const [filter, setFilter] = useState('');
  const [filterChips, setFilterChips] = useState('');

  const sortOptions = [
    {
      label: t('sortOptions.byName'),
      value: 'name',
    },
    {
      label: t('sortOptions.byRecentDate'),
      value: '-last_modification',
    },
  ];

  const getProjectList = async () => {
    try {
      const params = {
        ordering: sortOption,
        name: filter,
        description: filter,
        tags: filter,
      };
      const data = await get(PROJECTS_URI, { params });
      setProjectsList(data.results);
    } catch (error) {
      console.error(error);
    }
  };

  const handleSortOptions = (e) => {
    setSortOption(e.target.value);
  };

  useEffect(() => {
    getProjectList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortOption, filter]);

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
              <FilterTextField
                id="projects-filter"
                setFilter={setFilter}
                filterChips={filterChips}
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
              onClick={() => openModal(<AddOrEditProjectModal />, 'xl')}
            >
              <FaPlus />
              <span className="ml-2">{t('createProject')}</span>
            </button>
          </div>
          {useMemo(() => displayCards(projectsList, setFilterChips), [projectsList])}
        </div>
      </main>
    </>
  );
}
