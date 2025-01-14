import { useEffect, useMemo, useState } from 'react';

import { Pencil } from '@osrd-project/ui-icons';
import { useTranslation } from 'react-i18next';
import nextId from 'react-id-generator';
import { useParams } from 'react-router-dom';

import AddNewCard from 'applications/operationalStudies/components/AddNewCard';
import BreadCrumbs from 'applications/operationalStudies/components/BreadCrumbs';
import FilterTextField from 'applications/operationalStudies/components/FilterTextField';
import DateBox from 'applications/operationalStudies/components/Study/DateBox';
import StateStep from 'applications/operationalStudies/components/Study/StateStep';
import { type StudyState, studyStates } from 'applications/operationalStudies/consts';
import {
  type PostSearchApiArg,
  osrdEditoastApi,
  type ScenarioWithDetails,
} from 'common/api/osrdEditoastApi';
import { useModal } from 'common/BootstrapSNCF/ModalSNCF';
import NavBarSNCF from 'common/BootstrapSNCF/NavBarSNCF';
import OptionsSNCF from 'common/BootstrapSNCF/OptionsSNCF';
import { Loader, Spinner } from 'common/Loaders';
import SelectionToolbar from 'common/SelectionToolbar';
import AddOrEditScenarioModal from 'modules/scenario/components/AddOrEditScenarioModal';
import ScenarioCard from 'modules/scenario/components/ScenarioCard';
import { cleanScenarioLocalStorage } from 'modules/scenario/helpers/utils';
import AddOrEditStudyModal from 'modules/study/components/AddOrEditStudyModal';
import { budgetFormat } from 'utils/numbers';

import useMultiSelection from '../hooks/useMultiSelection';

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

const Study = () => {
  const { t } = useTranslation(['operationalStudies/study']);
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
    {
      projectId: projectId!,
      studyId: studyId!,
    },
    {
      skip: !projectId || !studyId,
    }
  );

  const [postSearch] = osrdEditoastApi.endpoints.postSearch.useMutation();
  const [deleteScenario] =
    osrdEditoastApi.endpoints.deleteProjectsByProjectIdStudiesAndStudyIdScenariosScenarioId.useMutation(
      {}
    );

  const { data: scenarios } =
    osrdEditoastApi.endpoints.getProjectsByProjectIdStudiesAndStudyIdScenarios.useQuery(
      {
        projectId: projectId!,
        studyId: studyId!,
        ordering: sortOption,
        pageSize: 1000,
      },
      { skip: !projectId || !studyId }
    );

  const {
    selectedItemIds: selectedScenarioIds,
    setSelectedItemIds: setSelectedScenarioIds,
    items: scenariosList,
    setItems: setScenariosList,
    toggleSelection: toggleScenarioSelection,
    deleteItems,
  } = useMultiSelection<ScenarioWithDetails>((scenarioId) => {
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
      label: t('sortOptions.byName'),
      value: 'NameAsc',
    },
    {
      label: t('sortOptions.byRecentDate'),
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
          let filteredScenarios = (await postSearch(payload).unwrap()) as ScenarioWithDetails[];
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
            translationNamespaces="operationalStudies/study"
            testId="add-scenario-button"
            className="scenario-card empty"
            modalComponent={<AddOrEditScenarioModal />}
            legendTranslationKey="createScenario"
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
      <NavBarSNCF appName={<BreadCrumbs project={study?.project} study={study} />} />
      <main className="mastcontainer mastcontainer-no-mastnav">
        <div className="p-3 study-view">
          {study ? (
            <div className="study-details">
              <div className="study-details-dates">
                <DateBox
                  date={study.creation_date ? new Date(study.creation_date) : null}
                  className="creation"
                  translation="creation"
                />
                <DateBox
                  date={study.start_date ? new Date(study.start_date) : null}
                  className="start"
                  translation="start"
                  withoutTime
                />
                <DateBox
                  date={study.expected_end_date ? new Date(study.expected_end_date) : null}
                  className="expected-end"
                  translation="expectedEnd"
                  withoutTime
                />
                <DateBox
                  date={study.actual_end_date ? new Date(study.actual_end_date) : null}
                  className="real-end"
                  translation="realEnd"
                  withoutTime
                />
                <DateBox
                  date={study.last_modification ? new Date(study.last_modification) : null}
                  className="modified"
                  translation="modified"
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
                    <span className="study-details-modify-button-text">{t('modifyStudy')}</span>
                    <Pencil />
                  </button>
                </div>
                {study.study_type && (
                  <div className="study-details-type">
                    {t(`studyCategories.${study.study_type}`)}
                  </div>
                )}
                <div className="study-details-description">{study.description}</div>
                {study.state && (
                  <div className="study-details-state">
                    {studyStates.map(
                      (state, idx) =>
                        study.project.id &&
                        study.id &&
                        study.state && (
                          <StateStep
                            key={nextId()}
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
                        <h3>{t('studyServiceCode')}</h3>
                        <div data-testid="study-service-code-info" className="code">
                          {study.service_code}
                        </div>
                      </div>
                    )}
                    {study.business_code && (
                      <div className="study-details-financials-infos-item">
                        <h3>{t('studyBusinessCode')}</h3>
                        <div data-testid="study-business-code-info" className="code">
                          {study.business_code}
                        </div>
                      </div>
                    )}
                  </div>
                  {study.budget ? (
                    <div className="study-details-financials-amount">
                      <span className="study-details-financials-amount-text">{t('budget')}</span>
                      {budgetFormat(study.budget)}
                    </div>
                  ) : null}
                </div>
              )}

              <div className="study-details-footer">
                <div className="study-details-tags">
                  {study.tags?.map((tag) => (
                    <div className="study-details-tags-tag" key={nextId()}>
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
            <div>{t('scenariosCount', { count: scenariosList.length })}</div>
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
              translationKey="selectedScenarios"
              translationNameSpace="operationalStudies/study"
              dataTestId="deleteScenarios"
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

export default Study;
