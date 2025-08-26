import { useEffect, useMemo, useState } from 'react';

import { Pencil } from '@osrd-project/ui-icons';
import { skipToken } from '@reduxjs/toolkit/query';
import { useTranslation } from 'react-i18next';
import { useParams } from 'react-router-dom';

import AddNewCard from 'applications/operationalStudies/components/AddNewCard';
import BreadCrumbs from 'applications/operationalStudies/components/BreadCrumbs';
import FilterTextField from 'applications/operationalStudies/components/FilterTextField';
import AddOrEditStudyModal from 'applications/operationalStudies/components/Study/AddOrEditStudyModal';
import type { ScenarioCardDetails } from 'applications/operationalStudies/types';
import {
  type PostSearchApiArg,
  osrdEditoastApi,
  type SearchResultItemScenario,
} from 'common/api/osrdEditoastApi';
import { useModal } from 'common/BootstrapSNCF/ModalSNCF';
import OptionsSNCF from 'common/BootstrapSNCF/OptionsSNCF';
import { Loader, Spinner } from 'common/Loaders';
import NavBar from 'common/NavBar';
import SelectionToolbar from 'common/SelectionToolbar';
import AddOrEditScenarioModal from 'modules/scenario/components/AddOrEditScenarioModal';
import { cleanScenarioLocalStorage } from 'modules/scenario/helpers/utils';
import { budgetFormat } from 'utils/numbers';

import DateBox from './components/DateBox';
import ScenarioCard from './components/ScenarioCard';
import StateStep from './components/StateStep';
import { type StudyState, studyStates } from './consts';
import useMultiSelection from '../../hooks/useMultiSelection';

type SortOptions =
  | 'NameAsc'
  | 'NameDesc'
  | 'CreationDateAsc'
  | 'CreationDateDesc'
  | 'LastModifiedAsc'
  | 'LastModifiedDesc';

type studyParams = {
  projectId: string;
  studyId: string;
};

const StudyView = () => {
  const { t } = useTranslation('operational-studies');
  const { openModal } = useModal();
  const { projectId: urlProjectId, studyId: urlStudyId } = useParams() as studyParams;

  const [filter, setFilter] = useState('');
  const [filterChips, setFilterChips] = useState('');
  const [sortOption, setSortOption] = useState<SortOptions>('LastModifiedDesc');
  const [isLoading, setIsLoading] = useState(true);

  const { projectId, studyId } = useMemo(
    () => ({
      projectId: !Number.isNaN(+urlProjectId) ? +urlProjectId : undefined,
      studyId: !Number.isNaN(+urlStudyId) ? +urlStudyId : undefined,
    }),
    [urlStudyId, urlProjectId]
  );

  const {
    data: study,
    isError: isCurrentStudyError,
    error: studyError,
  } = osrdEditoastApi.endpoints.getProjectsByProjectIdStudiesAndStudyId.useQuery(
    projectId && studyId
      ? {
          projectId,
          studyId,
        }
      : skipToken
  );

  const [postSearch] = osrdEditoastApi.endpoints.postSearch.useMutation();
  const [deleteScenario] =
    osrdEditoastApi.endpoints.deleteProjectsByProjectIdStudiesAndStudyIdScenariosScenarioId.useMutation(
      {}
    );

  const { data: scenarios } =
    osrdEditoastApi.endpoints.getProjectsByProjectIdStudiesAndStudyIdScenarios.useQuery(
      projectId && studyId
        ? {
            projectId,
            studyId,
            ordering: sortOption,
            pageSize: 1000,
          }
        : skipToken
    );

  const {
    selectedItemIds: selectedScenarioIds,
    setSelectedItemIds: setSelectedScenarioIds,
    items: scenariosList,
    setItems: setScenariosList,
    toggleSelection: toggleScenarioSelection,
    deleteItems,
  } = useMultiSelection<ScenarioCardDetails>((scenarioId) => {
    deleteScenario({ projectId: projectId!, studyId: studyId!, scenarioId });

    // For each scenarios, clean the local storage if a manchette is saved
    const deletedScenario = scenarios!.results.find((scenario) => scenario.id === scenarioId);
    cleanScenarioLocalStorage(deletedScenario!.timetable_id);
  });
  const handleDeleteScenario = () => {
    if (selectedScenarioIds.length > 0 && studyId && projectId) {
      deleteItems();
    }
  };
  useEffect(() => {
    if (!projectId || !studyId) throw new Error('Missing projectId or studyId in url');
  }, [projectId, studyId]);

  useEffect(() => {
    if (isCurrentStudyError && studyError) throw studyError;
  }, [isCurrentStudyError, studyError]);

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

  const handleSortOptions = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSortOption(e.target.value as SortOptions);
  };

  const getScenarioList = async () => {
    setIsLoading(true);
    if (projectId && studyId) {
      if (filter) {
        const payload: PostSearchApiArg = {
          pageSize: 1000,
          searchPayload: {
            object: 'scenario',
            query: [
              'and',
              [
                'or',
                ['search', ['name'], filter],
                ['search', ['description'], filter],
                ['search', ['tags'], filter],
              ],
              ['=', ['study_id'], studyId],
            ],
          },
        };
        try {
          let filteredScenarios = (await postSearch(
            payload
          ).unwrap()) as SearchResultItemScenario[];
          if (sortOption === 'LastModifiedDesc') {
            filteredScenarios = [...filteredScenarios].sort((a, b) =>
              b.last_modification.localeCompare(a.last_modification)
            );
          } else if (sortOption === 'NameAsc') {
            filteredScenarios = [...filteredScenarios].sort((a, b) => a.name.localeCompare(b.name));
          }
          setScenariosList(filteredScenarios);
        } catch (error) {
          console.error(error);
        }
      } else {
        setScenariosList(scenarios?.results || []);
      }
      setIsLoading(false);
    }
    setIsLoading(false);
  };

  function displayScenariosList() {
    return !isLoading ? (
      <div className="row no-gutters">
        <div className="col-hdp-3 col-hd-4 col-lg-6">
          <AddNewCard
            testId="add-scenario-button"
            className="scenario-card empty"
            modalComponent={<AddOrEditScenarioModal />}
            item="scenario"
          />
        </div>
        {scenariosList.map((scenario) => (
          <div
            className="col-hdp-3 col-hd-4 col-lg-6"
            key={`study-displayScenariosList-${scenario.id}`}
          >
            <ScenarioCard
              setFilterChips={setFilterChips}
              scenario={scenario}
              isSelected={scenario.id !== undefined && selectedScenarioIds.includes(scenario.id)}
              toggleSelect={toggleScenarioSelection}
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
    getScenarioList();
  }, [sortOption, filter, scenarios]);

  return (
    <>
      <NavBar appName={<BreadCrumbs project={study?.project} study={study} />} />
      <main className="mastcontainer mastcontainer-no-mastnav">
        <div className="p-3 study-view">
          {study ? (
            <div className="study-details">
              <div className="study-details-dates">
                <DateBox
                  date={study.creation_date ? new Date(study.creation_date) : null}
                  type="creation"
                />
                <DateBox
                  date={study.start_date ? new Date(study.start_date) : null}
                  type="start"
                  withoutTime
                />
                <DateBox
                  date={study.expected_end_date ? new Date(study.expected_end_date) : null}
                  type="expected-end"
                  withoutTime
                />
                <DateBox
                  date={study.actual_end_date ? new Date(study.actual_end_date) : null}
                  type="real-end"
                  withoutTime
                />
                <DateBox
                  date={study.last_modification ? new Date(study.last_modification) : null}
                  type="modified"
                />
              </div>
              <div className="d-flex flex-column p-2">
                <div className="study-details-name">
                  <div data-testid="study-name-info" className="study-name">
                    {study.name}
                  </div>
                  <button
                    data-testid="study-modify-button"
                    className="study-details-modify-button"
                    type="button"
                    onClick={() =>
                      openModal(
                        <AddOrEditStudyModal
                          editionMode
                          study={study}
                          scenarios={scenarios?.results}
                        />,
                        'xl',
                        'no-close-modal'
                      )
                    }
                  >
                    <span className="study-details-modify-button-text">
                      {t('study.modifyStudy')}
                    </span>
                    <Pencil />
                  </button>
                </div>
                {study.study_type && (
                  <div className="study-details-type" data-testid="study-type">
                    {t(`study.studyCategories.${study.study_type}`)}
                  </div>
                )}
                <div className="study-details-description" data-testid="study-description">
                  {study.description}
                </div>
                {study.state && (
                  <div className="study-details-state">
                    {studyStates.map(
                      (state, idx) =>
                        study.project.id &&
                        study.id &&
                        study.state && (
                          <StateStep
                            key={state}
                            study={study}
                            number={idx + 1}
                            state={state}
                            done={idx <= studyStates.indexOf(study.state as StudyState)}
                          />
                        )
                    )}
                  </div>
                )}
              </div>

              {(study.service_code ||
                study.business_code ||
                (study.budget !== 0 && study.budget !== null)) && (
                <div className="study-details-financials">
                  <div className="study-details-financials-infos">
                    {study.service_code && (
                      <div className="study-details-financials-infos-item">
                        <h3>{t('study.study-service-code')}</h3>
                        <div data-testid="study-service-code-info" className="code">
                          {study.service_code}
                        </div>
                      </div>
                    )}
                    {study.business_code && (
                      <div className="study-details-financials-infos-item">
                        <h3>{t('study.study-business-code')}</h3>
                        <div data-testid="study-business-code-info" className="code">
                          {study.business_code}
                        </div>
                      </div>
                    )}
                  </div>
                  {study.budget ? (
                    <div
                      className="study-details-financials-amount"
                      data-testid="study-financial-amount"
                    >
                      <span className="study-details-financials-amount-text">
                        {t('study.budget')}
                      </span>
                      {budgetFormat(study.budget)}
                    </div>
                  ) : null}
                </div>
              )}

              <div className="study-details-footer">
                <div className="study-details-tags" data-testid="study-tags">
                  {study.tags?.map((tag) => (
                    <div className="study-details-tags-tag" key={tag}>
                      {tag}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <span className="mt-5">
              <Loader position="center" />
            </span>
          )}

          <div className="scenarios-toolbar">
            <div>{t('scenario.count', { count: scenariosList.length })}</div>
            <div className="flex-grow-1">
              <FilterTextField
                setFilter={setFilter}
                filterChips={filterChips}
                id="scenarios-filter"
                sm
              />
            </div>

            <OptionsSNCF
              name="projects-sort-filter"
              onChange={handleSortOptions}
              selectedValue={sortOption}
              options={sortOptions}
              sm
            />
          </div>
          {selectedScenarioIds.length > 0 && (
            <SelectionToolbar
              selectedItemCount={selectedScenarioIds.length}
              onDeselectAll={() => setSelectedScenarioIds([])}
              onDelete={handleDeleteScenario}
              item="scenario"
              dataTestId="delete-scenario-button"
            />
          )}

          <div className="scenarios-list">
            {useMemo(() => displayScenariosList(), [scenariosList, selectedScenarioIds])}
          </div>
        </div>
      </main>
    </>
  );
};

export default StudyView;
