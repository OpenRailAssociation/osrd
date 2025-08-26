import { useEffect, useMemo, useState } from 'react';

import { Pencil } from '@osrd-project/ui-icons';
import { skipToken } from '@reduxjs/toolkit/query';
import { useTranslation } from 'react-i18next';
import { BiTargetLock } from 'react-icons/bi';
import ReactMarkdown from 'react-markdown';
import { useParams } from 'react-router-dom';
import remarkGfm from 'remark-gfm';

import AddNewCard from 'applications/operationalStudies/components/AddNewCard';
import BreadCrumbs from 'applications/operationalStudies/components/BreadCrumbs';
import FilterTextField from 'applications/operationalStudies/components/FilterTextField';
import AddOrEditStudyModal from 'applications/operationalStudies/components/Study/AddOrEditStudyModal';
import useMultiSelection from 'applications/operationalStudies/hooks/useMultiSelection';
import type { StudyCardDetails } from 'applications/operationalStudies/types';
import { getDocument } from 'common/api/documentApi';
import {
  type PostSearchApiArg,
  type SearchResultItemStudy,
  osrdEditoastApi,
} from 'common/api/osrdEditoastApi';
import { useModal } from 'common/BootstrapSNCF/ModalSNCF';
import OptionsSNCF from 'common/BootstrapSNCF/OptionsSNCF';
import { Loader, Spinner } from 'common/Loaders';
import NavBar from 'common/NavBar';
import SelectionToolbar from 'common/SelectionToolbar';
import AddOrEditProjectModal from 'modules/project/components/AddOrEditProjectModal';
import { cleanScenarioLocalStorage } from 'modules/scenario/helpers/utils';
import { budgetFormat } from 'utils/numbers';

import StudyCard from './StudyCard';

type SortOptions =
  | 'NameAsc'
  | 'NameDesc'
  | 'CreationDateAsc'
  | 'CreationDateDesc'
  | 'LastModifiedAsc'
  | 'LastModifiedDesc';

type ProjectParams = {
  projectId: string;
};

const ProjectView = () => {
  const { t } = useTranslation('operational-studies');
  const { openModal } = useModal();
  const [filter, setFilter] = useState('');
  const [filterChips, setFilterChips] = useState('');
  const [sortOption, setSortOption] = useState<SortOptions>('LastModifiedDesc');
  const [imageUrl, setImageUrl] = useState<string>();
  const [isLoading, setIsLoading] = useState(true);

  const { projectId: urlProjectId } = useParams() as ProjectParams;
  const [deleteStudy] =
    osrdEditoastApi.endpoints.deleteProjectsByProjectIdStudiesAndStudyId.useMutation();
  const [postSearch] = osrdEditoastApi.endpoints.postSearch.useMutation();

  const { projectId } = useMemo(
    () => ({
      projectId: !Number.isNaN(+urlProjectId) ? +urlProjectId : undefined,
    }),
    [urlProjectId]
  );

  const {
    data: project,
    isError: isProjectError,
    error: projectError,
  } = osrdEditoastApi.endpoints.getProjectsByProjectId.useQuery(
    projectId ? { projectId: +projectId } : skipToken
  );

  const { data: projectStudies } = osrdEditoastApi.endpoints.getProjectsByProjectIdStudies.useQuery(
    projectId
      ? {
          projectId: Number(projectId),
          ordering: sortOption,
          pageSize: 1000,
        }
      : skipToken
  );

  const [getScenarios] =
    osrdEditoastApi.endpoints.getProjectsByProjectIdStudiesAndStudyIdScenarios.useLazyQuery();

  const {
    selectedItemIds: selectedStudyIds,
    setSelectedItemIds: setSelectedStudyIds,
    items: studiesList,
    setItems: setStudiesList,
    toggleSelection: toggleStudySelection,
    deleteItems,
  } = useMultiSelection<StudyCardDetails>(async (studyId) => {
    const { data: scenarios } = await getScenarios({ projectId: projectId!, studyId });

    deleteStudy({ projectId: projectId!, studyId });

    // For each scenario in the selected studies, clean the local storage if a manchette is saved
    if (scenarios) {
      scenarios.results.forEach((scenario) => {
        cleanScenarioLocalStorage(scenario.timetable_id);
      });
    }
  });

  const handleDeleteStudy = () => {
    if (selectedStudyIds.length > 0 && projectId) {
      deleteItems();
    }
  };
  const sortOptions = [
    {
      label: t('operational-studies-management.sort-by-name'),
      value: 'NameAsc',
    },
    {
      label: t('operational-studies-management.sort-by-latest'),
      value: 'LastModifiedDesc',
    },
  ];

  const updateImage = async () => {
    if (project?.image) {
      const image = await getDocument(project.image);
      setImageUrl(URL.createObjectURL(image));
    }
  };

  const getStudiesList = async () => {
    setIsLoading(true);
    if (projectId) {
      if (filter) {
        const payload: PostSearchApiArg = {
          pageSize: 1000,
          searchPayload: {
            object: 'study',
            query: [
              'and',
              [
                'or',
                ['search', ['name'], filter],
                ['search', ['description'], filter],
                ['search', ['tags'], filter],
              ],
              ['=', ['project_id'], projectId],
            ],
          },
        };
        try {
          let filteredStudies = (await postSearch(payload).unwrap()) as SearchResultItemStudy[];
          if (sortOption === 'LastModifiedDesc') {
            filteredStudies = [...filteredStudies].sort((a, b) =>
              b.last_modification.localeCompare(a.last_modification)
            );
          } else if (sortOption === 'NameAsc') {
            filteredStudies = [...filteredStudies].sort((a, b) => a.name.localeCompare(b.name));
          }
          setStudiesList(filteredStudies);
        } catch (error) {
          console.error(error);
        }
      } else {
        setStudiesList(projectStudies?.results || []);
      }
    }
    setIsLoading(false);
  };

  function displayStudiesList() {
    return !isLoading ? (
      <div className="row no-gutters mt-2">
        <div className="col-hdp-3 col-hd-4 col-lg-6">
          <AddNewCard
            testId="add-study-button"
            className="study-card empty"
            modalComponent={<AddOrEditStudyModal />}
            item="study"
          />
        </div>
        {studiesList.map((study) => (
          <div
            className="col-hdp-3 col-hd-4 col-lg-6"
            key={`project-displayStudiesList-${study.id}`}
          >
            <StudyCard
              setFilterChips={setFilterChips}
              study={study}
              isSelected={study.id !== undefined && selectedStudyIds.includes(study.id)}
              toggleSelect={toggleStudySelection}
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

  const handleSortOptions = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSortOption(e.target.value as SortOptions);
  };

  useEffect(() => {
    if (!projectId) throw new Error('Project id is undefined');
  }, []);

  useEffect(() => {
    updateImage();
  }, [project?.image]);

  useEffect(() => {
    if (isProjectError && projectError) throw projectError;
  }, [isProjectError, projectError]);

  useEffect(() => {
    getStudiesList();
  }, [sortOption, filter, projectStudies]);

  return (
    <>
      <NavBar appName={<BreadCrumbs project={project} />} />

      <main className="mastcontainer mastcontainer-no-mastnav">
        <div className="p-3 project-view">
          {project ? (
            <div className="project-details">
              <div className="project-details-title">
                <div className="row w-100 no-gutters">
                  <div className={project.image ? 'col-lg-4 col-md-4' : 'd-none'}>
                    <div className="project-details-title-img">
                      {imageUrl && <img src={imageUrl} alt="project logo" />}
                    </div>
                  </div>
                  <div className={project.image ? 'pl-md-2 col-lg-8 col-md-8' : 'col-12'}>
                    <div className="project-details-title-content">
                      <div className="project-details-title-name" data-testid="project-name">
                        {project.name}
                        <button
                          data-testid="project-update-button"
                          className="project-details-title-modify-button"
                          type="button"
                          onClick={() =>
                            openModal(
                              <AddOrEditProjectModal
                                editionMode
                                project={project}
                                projectStudies={projectStudies?.results}
                              />,
                              'xl',
                              'no-close-modal'
                            )
                          }
                        >
                          <span className="project-details-title-modify-button-text">
                            {t('project.modifyProject')}
                          </span>
                          <Pencil />
                        </button>
                      </div>
                      <div className="row">
                        <div className="col-xl-6">
                          <div
                            className="project-details-title-description"
                            data-testid="project-description"
                          >
                            {project.description}
                          </div>
                        </div>
                        <div className="col-xl-6">
                          <h3>
                            <span className="mr-2">
                              <BiTargetLock />
                            </span>
                            {t('project.objectives')}
                          </h3>
                          <div
                            className="project-details-title-objectives"
                            data-testid="project-objectives"
                          >
                            {project.objectives && (
                              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                                {project.objectives}
                              </ReactMarkdown>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              {(project.funders || (project.budget !== 0 && project.budget !== null)) && (
                <div className="project-details-financials">
                  <div
                    className="project-details-financials-infos"
                    data-testid="project-financials-infos"
                  >
                    <h3>{t('project.fundedBy')}</h3>
                    {project.funders && <div>{project.funders}</div>}
                  </div>
                  {project.budget ? (
                    <div
                      className="project-details-financials-amount"
                      data-testid="project-financial-amount"
                    >
                      <span className="project-details-financials-amount-text">
                        {t('project.totalBudget')}
                      </span>
                      {budgetFormat(project.budget)}
                    </div>
                  ) : null}
                </div>
              )}
              <div className="project-details-tags" data-testid="project-tags">
                {project.tags?.map((tag) => (
                  <div className="project-details-tags-tag" key={tag}>
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

          <div className="studies-toolbar">
            <div className="h1 mb-0">
              {t('study.count', {
                count: studiesList ? studiesList.length : 0,
              })}
            </div>
            <div className="flex-grow-1">
              <FilterTextField
                setFilter={setFilter}
                filterChips={filterChips}
                id="studies-filter"
              />
            </div>

            <OptionsSNCF
              name="projects-sort-filter"
              onChange={handleSortOptions}
              selectedValue={sortOption}
              options={sortOptions}
            />
          </div>
          {selectedStudyIds.length > 0 && (
            <SelectionToolbar
              selectedItemCount={selectedStudyIds.length}
              onDeselectAll={() => setSelectedStudyIds([])}
              onDelete={handleDeleteStudy}
              item="study"
              dataTestId="deleteStudies"
            />
          )}
          <div className="studies-list">
            {useMemo(() => displayStudiesList(), [studiesList, selectedStudyIds])}
          </div>
        </div>
      </main>
    </>
  );
};

export default ProjectView;
