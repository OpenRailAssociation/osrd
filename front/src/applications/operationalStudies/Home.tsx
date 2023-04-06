import React, { useEffect, useMemo, useState } from 'react';
import { useDispatch } from 'react-redux';
import FilterTextField from 'applications/operationalStudies/components/FilterTextField';
import ProjectCard from 'applications/operationalStudies/components/Home/ProjectCard';
import ProjectCardEmpty from 'applications/operationalStudies/components/Home/ProjectCardEmpty';
import { PROJECTS_URI } from 'applications/operationalStudies/components/operationalStudiesConsts';
import { MODES } from 'applications/operationalStudies/consts';
import osrdLogo from 'assets/pictures/osrd.png';
import logo from 'assets/pictures/views/projects.svg';
import NavBarSNCF from 'common/BootstrapSNCF/NavBarSNCF';
import OptionsSNCF from 'common/BootstrapSNCF/OptionsSNCF';
import Loader from 'common/Loader';
import { get } from 'common/requests';
import { useTranslation } from 'react-i18next';
import nextId from 'react-id-generator';
import { updateMode } from 'reducers/osrdconf';
import { ProjectResult } from 'common/api/osrdEditoastApi';

function displayCards(
  projectsList: ProjectResult[],
  setFilterChips: (filterChips: string) => void
) {
  return projectsList ? (
    <div className="projects-list">
      <div className="row">
        <div className="col-lg-3 col-md-4 col-sm-6" key={nextId()}>
          <ProjectCardEmpty />
        </div>
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
  const [projectsList, setProjectsList] = useState<ProjectResult[]>([]);
  const [sortOption, setSortOption] = useState('LastModifiedDesc');
  const [filter, setFilter] = useState('');
  const [filterChips, setFilterChips] = useState('');
  const dispatch = useDispatch();

  const sortOptions = [
    {
      label: t('sortOptions.byName'),
      value: 'NameAsc',
    },
    {
      label: t('sortOptions.byRecentDate'),
      value: 'LastModifiedDesc',
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

  const handleSortOptions = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSortOption(e.target.value);
  };

  useEffect(() => {
    getProjectList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortOption, filter]);

  useEffect(() => {
    dispatch(updateMode(MODES.simulation));
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
          </div>
          {useMemo(() => displayCards(projectsList, setFilterChips), [projectsList])}
        </div>
      </main>
    </>
  );
}
