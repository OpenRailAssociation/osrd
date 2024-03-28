import React, { useEffect, useMemo, useState } from 'react';

import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import FilterTextField from 'applications/operationalStudies/components/FilterTextField';
import {
  type PostSearchApiArg,
  type ProjectWithStudies,
  type SearchResultItemProject,
  osrdEditoastApi,
} from 'common/api/osrdEditoastApi';
import NavBarSNCF from 'common/BootstrapSNCF/NavBarSNCF';
import OptionsSNCF from 'common/BootstrapSNCF/OptionsSNCF';
import { Spinner } from 'common/Loaders';
import ProjectCard from 'modules/project/components/ProjectCard';
import ProjectCardEmpty from 'modules/project/components/ProjectCardEmpty';
import ProjectSelectionToolbar from 'modules/project/components/ProjectSelectionToolbar';
import { getUserSafeWord } from 'reducers/user/userSelectors';

type SortOptions =
  | 'NameAsc'
  | 'NameDesc'
  | 'CreationDateAsc'
  | 'CreationDateDesc'
  | 'LastModifiedAsc'
  | 'LastModifiedDesc';

export default function HomeOperationalStudies() {
  const { t } = useTranslation('operationalStudies/home');
  const safeWord = useSelector(getUserSafeWord);
  const [sortOption, setSortOption] = useState<SortOptions>('LastModifiedDesc');
  const [projectsList, setProjectsList] = useState<
    Array<ProjectWithStudies | SearchResultItemProject>
  >([]);
  const [selectedProjectIds, setSelectedProjectIds] = useState<number[]>([]);
  const [filter, setFilter] = useState('');
  const [filterChips, setFilterChips] = useState('');
  const [postSearch] = osrdEditoastApi.endpoints.postSearch.useMutation();

  const { data: allProjects } = osrdEditoastApi.endpoints.getProjects.useQuery({
    ordering: sortOption,
    pageSize: 1000,
  });
  const [isLoading, setIsLoading] = useState(true);

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
    setIsLoading(true);
    if (filter || safeWord !== '') {
      const payload: PostSearchApiArg = {
        pageSize: 1000,
        searchPayload: {
          object: 'project',
          query: [
            'and',
            [
              'or',
              ['search', ['name'], filter],
              ['search', ['description'], filter],
              ['search', ['tags'], filter],
            ],
            safeWord !== '' ? ['search', ['tags'], safeWord] : true,
          ],
        },
      };
      try {
        let filteredData = (await postSearch(payload).unwrap()) as SearchResultItemProject[];
        if (sortOption === 'LastModifiedDesc') {
          filteredData = [...filteredData].sort((a, b) =>
            b.last_modification.localeCompare(a.last_modification)
          );
        } else if (sortOption === 'NameAsc') {
          filteredData = [...filteredData].sort((a, b) => a.name.localeCompare(b.name));
        }
        setProjectsList(filteredData);
      } catch (error) {
        console.error('filter projetcs error : ', error);
      }
    } else {
      setProjectsList(allProjects?.results || []);
    }
    setIsLoading(false);
  };

  const handleSortOptions = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSortOption(e.target.value as SortOptions);
  };

  const toggleProjectSelection = (id?: number) => {
    if (id !== undefined) {
      setSelectedProjectIds(
        selectedProjectIds.indexOf(id) !== -1
          ? selectedProjectIds.filter((projectId) => projectId !== id)
          : selectedProjectIds.concat([id])
      );
    }
  };

  function displayCards() {
    return !isLoading ? (
      <div className="projects-list row">
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
    ) : (
      <span className="mt-5 text-center">
        <Spinner displayDelay={500} />
      </span>
    );
  }

  useEffect(() => {
    getProjectList();
  }, [sortOption, filter, safeWord, allProjects]);

  return (
    <>
      <NavBarSNCF appName={<div className="navbar-breadcrumbs">{t('projects')}</div>} />
      <main className="mastcontainer mastcontainer-no-mastnav">
        <div className="p-3">
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
