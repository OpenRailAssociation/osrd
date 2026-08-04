import { useCallback, useEffect, useMemo, useState } from 'react';

import { Pencil } from '@osrd-project/ui-icons';
import { skipToken } from '@reduxjs/toolkit/query';
import cx from 'classnames';
import { useTranslation } from 'react-i18next';
import { BiTargetLock } from 'react-icons/bi';
import ReactMarkdown from 'react-markdown';
import { useSelector } from 'react-redux';
import { useParams } from 'react-router-dom';
import remarkGfm from 'remark-gfm';

import AddNewCard from 'applications/operationalStudies/components/AddNewCard';
import BreadCrumbs from 'applications/operationalStudies/components/BreadCrumbs';
import FilterTextField from 'applications/operationalStudies/components/FilterTextField';
import AddOrEditStudyModal from 'applications/operationalStudies/components/Study/AddOrEditStudyModal';
import useMultiSelection from 'applications/operationalStudies/hooks/useMultiSelection';
import type { StudyCardDetails } from 'applications/operationalStudies/types';
import {
  type PostSearchApiArg,
  type SearchResultItemStudy,
  osrdEditoastApi,
} from 'common/api/osrdEditoastApi';
import GrantsManager from 'common/authorization/components/GrantsManager';
import { useModal } from 'common/BootstrapSNCF/ModalSNCF';
import OptionsSNCF from 'common/BootstrapSNCF/OptionsSNCF';
import { Loader, Spinner } from 'common/Loaders';
import NavBar from 'common/NavBar';
import SelectionToolbar from 'common/SelectionToolbar';
import AddOrEditProjectModal from 'modules/project/components/AddOrEditProjectModal';
import { cleanScenarioLocalStorage } from 'modules/scenario/helpers/utils';
import { getFeatureFlag } from 'reducers/user/userSelectors';
import { useProjectImage } from 'utils/hooks/useProjectImage';
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
  const projectGrantsActivated = useSelector(getFeatureFlag('projectGrants'));
  const [filter, setFilter] = useState('');
  const [filterChips, setFilterChips] = useState('');
  const [sortOption, setSortOption] = useState<SortOptions>('LastModifiedDesc');
  const [isLoading, setIsLoading] = useState(true);

  const { projectId: urlProjectId } = useParams() as ProjectParams;
  const [deleteStudy] = osrdEditoastApi.endpoints.deleteStudiesByStudyId.useMutation();
  const [postSearch] = osrdEditoastApi.endpoints.postSearch.useLazyQuery();

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

  const imageUrl = useProjectImage(project?.image);

  const { data: projectStudies } = osrdEditoastApi.endpoints.getStudies.useQuery(
    projectId
      ? {
          projectId: Number(projectId),
          ordering: sortOption,
          pageSize: 1000,
        }
      : skipToken
  );

  const [getScenarios] = osrdEditoastApi.endpoints.getScenarios.useLazyQuery();

  const {
    selectedItemIds: selectedStudyIds,
    setSelectedItemIds: setSelectedStudyIds,
    items: studiesList,
    setItems: setStudiesList,
    toggleSelection: toggleStudySelection,
    deleteItems,
  } = useMultiSelection<StudyCardDetails>(async (studyId) => {
    const { data: scenarios } = await getScenarios({ studyId });

    deleteStudy({ studyId });

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
    if (isProjectError && projectError) throw projectError;
  }, [isProjectError, projectError]);

  useEffect(() => {
    getStudiesList();
  }, [sortOption, filter, projectStudies]);

  const openAddOrEditProjectModal = useCallback(() => {
    openModal(
      <AddOrEditProjectModal
        editionMode
        project={project}
        projectStudies={projectStudies?.results}
      />,
      'xl',
      'no-close-modal'
    );
  }, [openModal, project, projectStudies]);

  return (
    <>
      <NavBar appName={<BreadCrumbs project={project} />} />

      <main className="mastcontainer mastcontainer-no-mastnav">
        <div className="p-3 project-view">
          {project ? (
            <div className="project-details">
              <div className="project-details-title">
                <div className="row w-100 no-gutters">
                  <div className={'col-lg-4 col-md-4'}>
                    <div className="project-details-title-img">
                      <img src={imageUrl} alt={t('project.projectImage')} />
                    </div>
                    {/* TODO: adapt with the good resourceType when back is ready */}
                    {projectGrantsActivated && (
                      <GrantsManager resourceId={project.id} resourceType="infra" />
                    )}
                  </div>
                  <div className={'pl-md-2 col-lg-8 col-md-8'}>
                    <div className="project-details-title-content">
                      <div className="project-details-title-name" data-testid="project-name">
                        {project.name}
                        <button
                          data-testid="project-update-button"
                          className="project-details-title-modify-button"
                          type="button"
                          onClick={openAddOrEditProjectModal}
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
          <div
            className={cx('studies-list', {
              'selection-mode': selectedStudyIds.length > 0,
            })}
          >
            {useMemo(() => displayStudiesList(), [studiesList, selectedStudyIds])}
          </div>
        </div>
      </main>
    </>
  );
};

export default ProjectView;
