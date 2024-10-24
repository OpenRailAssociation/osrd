import { useEffect, useMemo, useState } from 'react';

import { useTranslation } from 'react-i18next';
import { useSelector } from 'react-redux';

import FilterTextField from 'applications/operationalStudies/components/FilterTextField';
import AddNewCard from 'common/AddNewCard';
import {
  osrdEditoastApi,
  type PostSearchApiArg,
  type ProjectWithStudies,
  type SearchResultItemProject,
} from 'common/api/osrdEditoastApi';
import NavBarSNCF from 'common/BootstrapSNCF/NavBarSNCF';
import OptionsSNCF from 'common/BootstrapSNCF/OptionsSNCF';
import { Spinner } from 'common/Loaders';
import SelectionToolbar from 'common/SelectionToolbar';
import AddOrEditProjectModal from 'modules/project/components/AddOrEditProjectModal';
import ProjectCard from 'modules/project/components/ProjectCard';
import cleanLocalStorageByProject from 'modules/project/helpers/cleanLocalStorageByProject';
import { getUserSafeWord } from 'reducers/user/userSelectors';
import { useAppDispatch } from 'store';
import { getLogo } from 'utils/logo';

import useMultiSelection from './hooks/useMultiSelection';

type SortOptions =
  | 'NameAsc'
  | 'NameDesc'
  | 'CreationDateAsc'
  | 'CreationDateDesc'
  | 'LastModifiedAsc'
  | 'LastModifiedDesc';

const HomeOperationalStudies = () => {
  const { t } = useTranslation('operationalStudies/home');
  const dispatch = useAppDispatch();
  const safeWord = useSelector(getUserSafeWord);
  const [sortOption, setSortOption] = useState<SortOptions>('LastModifiedDesc');
  const [filter, setFilter] = useState('');
  const [filterChips, setFilterChips] = useState('');
  const [deleteProject] = osrdEditoastApi.endpoints.deleteProjectsByProjectId.useMutation();

  const [getStudies] = osrdEditoastApi.endpoints.getProjectsByProjectIdStudies.useLazyQuery();

  const {
    selectedItemIds: selectedProjectIds,
    setSelectedItemIds: setSelectedProjectIds,
    items: projectsList,
    setItems: setProjectsList,
    toggleSelection: toggleProjectSelection,
    deleteItems,
  } = useMultiSelection<ProjectWithStudies | SearchResultItemProject>(async (projectId) => {
    // For each scenario in the selected projects, clean the local storage if a manchette is saved
    const { data: studies } = await getStudies({ projectId });
    if (studies) {
      cleanLocalStorageByProject(projectId, studies.results, dispatch);
    }

    deleteProject({ projectId });
  });

  const handleDeleteProjects = () => {
    if (selectedProjectIds.length > 0) {
      deleteItems();
    }
  };
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

  function displayCards() {
    return !isLoading ? (
      <div className="projects-list row">
        <div className="col-hdp-2 col-lg-3 col-md-4 col-sm-6">
          <AddNewCard
            translationNamespaces="operationalStudies/home"
            testId="addProject"
            className="project-card empty"
            modalComponent={<AddOrEditProjectModal />}
            legendTranslationKey="createProject"
          />
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
      <NavBarSNCF
        logo={getLogo()}
        appName={<div className="navbar-breadcrumbs">{t('projects')}</div>}
      />
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

          {selectedProjectIds.length > 0 && (
            <SelectionToolbar
              selectedItemCount={selectedProjectIds.length}
              onDeselectAll={() => setSelectedProjectIds([])}
              onDelete={handleDeleteProjects}
              translationKey="selectedProjects"
              translationNameSpace="operationalStudies/home"
              dataTestId="deleteProjects"
            />
          )}

          {useMemo(() => displayCards(), [projectsList, selectedProjectIds])}
        </div>
      </main>
    </>
  );
};

export default HomeOperationalStudies;
