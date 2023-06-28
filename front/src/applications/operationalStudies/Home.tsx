import React, { useEffect, useMemo, useState } from 'react';
import FilterTextField from 'applications/operationalStudies/components/FilterTextField';
import ProjectSelectionToolbar from 'applications/operationalStudies/components/Home/ProjectSelectionToolbar';
import ProjectCard from 'applications/operationalStudies/components/Home/ProjectCard';
import ProjectCardEmpty from 'applications/operationalStudies/components/Home/ProjectCardEmpty';
import osrdLogo from 'assets/pictures/osrd.png';
import logo from 'assets/pictures/views/projects.svg';
import NavBarSNCF from 'common/BootstrapSNCF/NavBarSNCF';
import OptionsSNCF from 'common/BootstrapSNCF/OptionsSNCF';
import Loader from 'common/Loader';
import { useTranslation } from 'react-i18next';
import {
  PostSearchApiArg,
  ProjectResult,
  SearchProjectResult,
  osrdEditoastApi,
} from 'common/api/osrdEditoastApi';

type SortOptions =
  | 'NameAsc'
  | 'NameDesc'
  | 'CreationDateAsc'
  | 'CreationDateDesc'
  | 'LastModifiedAsc'
  | 'LastModifiedDesc';

export default function Home() {
  const { t } = useTranslation('operationalStudies/home');
  const [sortOption, setSortOption] = useState<SortOptions>('LastModifiedDesc');
  const [projectsList, setProjectsList] = useState<ProjectResult[]>([]);
  const [selectedProjectIds, setSelectedProjectIds] = useState<number[]>([]);
  const [filter, setFilter] = useState('');
  const [filterChips, setFilterChips] = useState('');
  const [postSearch] = osrdEditoastApi.usePostSearchMutation();
  const [getProjects] = osrdEditoastApi.useLazyGetProjectsQuery();

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
    if (filter) {
      const payload: PostSearchApiArg = {
        body: {
          object: 'project',
          query: [
            'and',
            [
              'or',
              ['search', ['name'], filter],
              ['search', ['description'], filter],
              ['search', ['tags'], filter],
            ],
          ],
        },
      };
      try {
        const data = await postSearch(payload).unwrap();
        let filteredData = [...data] as SearchProjectResult[];
        if (sortOption === 'LastModifiedDesc') {
          filteredData = filteredData.sort((a, b) => {
            if (a.last_modification && b.last_modification) {
              return b.last_modification.localeCompare(a.last_modification);
            }
            return 0;
          });
        } else if (sortOption === 'NameAsc') {
          filteredData = filteredData.sort((a, b) => {
            if (a.name && b.name) {
              return a.name.localeCompare(b.name);
            }
            return 0;
          });
        }
        setProjectsList(filteredData);
      } catch (error) {
        console.error('filter projetcs error : ', error);
      }
    } else {
      try {
        const projects = await getProjects({ ordering: sortOption });
        if (projects.data?.results) {
          setProjectsList(projects.data.results);
        }
      } catch (error) {
        console.error(error);
      }
    }
  };

  const handleSortOptions = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSortOption(e.target.value as SortOptions);
  };

  const toggleProjectSelection = (id?: number) => {
    if (id !== undefined) {
      const idPosition = selectedProjectIds.indexOf(id);
      if (idPosition !== -1) {
        const tempSelectedProjectIds = [...selectedProjectIds];
        tempSelectedProjectIds.splice(idPosition, 1);
        setSelectedProjectIds(tempSelectedProjectIds);
      } else {
        setSelectedProjectIds(selectedProjectIds.concat([id]));
      }
    }
  };

  function displayCards() {
    return projectsList ? (
      <div className="projects-list">
        <div className="row">
          <div className="col-hdp-2 col-lg-3 col-md-4 col-sm-6">
            <ProjectCardEmpty />
          </div>
          {projectsList.map((project) => (
            <div
              className="col-hdp-2 col-lg-3 col-md-4 col-sm-6"
              key={`home-projectsList-${project.id}`}
            >
              <ProjectCard
                project={project}
                setFilterChips={setFilterChips}
                isSelected={project.id !== undefined && selectedProjectIds.includes(project.id)}
                toggleSelect={toggleProjectSelection}
              />
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

  useEffect(() => {
    getProjectList();
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
          </div>
          <ProjectSelectionToolbar
            selectedProjectIds={selectedProjectIds}
            setSelectedProjectIds={setSelectedProjectIds}
            setProjectsList={setProjectsList}
            projectsList={projectsList}
          />
          {useMemo(() => displayCards(), [projectsList, selectedProjectIds])}
        </div>
      </main>
    </>
  );
}
