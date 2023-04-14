import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import NavBarSNCF from 'common/BootstrapSNCF/NavBarSNCF';
import logo from 'assets/pictures/views/study.svg';
import { useTranslation } from 'react-i18next';
import Loader from 'common/Loader';
import nextId from 'react-id-generator';
import OptionsSNCF from 'common/BootstrapSNCF/OptionsSNCF';
import ScenarioCard from 'applications/operationalStudies/components/Study/ScenarioCard';
import { setFailure, setSuccess } from 'reducers/main';
import ScenarioCardEmpty from 'applications/operationalStudies/components/Study/ScenarioCardEmpty';
import { VscLink, VscFile, VscFiles } from 'react-icons/vsc';
import { FaPencilAlt } from 'react-icons/fa';
import { budgetFormat } from 'utils/numbers';
import { useModal } from 'common/BootstrapSNCF/ModalSNCF';
import { useSelector, useDispatch } from 'react-redux';
import { getProjectID, getStudyID } from 'reducers/osrdconf/selectors';
import { get } from 'common/requests';
import DateBox from 'applications/operationalStudies/components/Study/DateBox';
import StateStep from 'applications/operationalStudies/components/Study/StateStep';
import {
  PostSearchApiArg,
  ProjectResult,
  ScenarioResult,
  SearchScenarioResult,
  StudyResult,
  osrdEditoastApi,
} from 'common/api/osrdEditoastApi';
import BreadCrumbs from '../components/BreadCrumbs';
import AddOrEditStudyModal from '../components/Study/AddOrEditStudyModal';
import FilterTextField from '../components/FilterTextField';

type SortOptions =
  | 'NameAsc'
  | 'NameDesc'
  | 'CreationDateAsc'
  | 'CreationDateDesc'
  | 'LastModifiedAsc'
  | 'LastModifiedDesc';

type StateType = 'started' | 'inProgress' | 'finish';

// While files property is not implemented in studies
type StudyWithFileType = StudyResult & {
  files: {
    filename: string;
    url: string;
    name: string;
  }[];
};

function displayScenariosList(
  scenariosList: ScenarioResult[],
  setFilterChips: (filterChips: string) => void
) {
  return scenariosList ? (
    <div className="row no-gutters">
      <div className="col-xl-4 col-lg-6">
        <ScenarioCardEmpty />
      </div>
      {scenariosList.map((scenario) => (
        <div className="col-xl-4 col-lg-6" key={`study-displayScenariosList-${scenario.id}`}>
          <ScenarioCard scenario={scenario} setFilterChips={setFilterChips} />
        </div>
      ))}
    </div>
  ) : (
    <span className="mt-5">
      <Loader position="center" />
    </span>
  );
}

export default function Study() {
  const { t } = useTranslation('operationalStudies/study');
  const { openModal } = useModal();
  const [project, setProject] = useState<ProjectResult>();
  const [study, setStudy] = useState<StudyWithFileType>();
  const [scenariosList, setScenariosList] = useState<ScenarioResult[]>([]);
  const [filter, setFilter] = useState('');
  const [filterChips, setFilterChips] = useState('');
  const [sortOption, setSortOption] = useState<SortOptions>('LastModifiedDesc');
  const [studyStates, setStudyStates] = useState<StateType[]>([]);
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const projectId = useSelector(getProjectID);
  const studyId = useSelector(getStudyID);
  const {
    data: currentProject,
    isLoading: isProjectLoading,
    isError: isProjectError,
    error: projectError,
  } = osrdEditoastApi.useGetProjectsByProjectIdQuery({ projectId: projectId as number });
  const [getCurrentStudy] = osrdEditoastApi.useLazyGetProjectsByProjectIdStudiesAndStudyIdQuery();
  const [postSearch] = osrdEditoastApi.usePostSearchMutation();
  const [getScenarios] =
    osrdEditoastApi.useLazyGetProjectsByProjectIdStudiesAndStudyIdScenariosQuery();

  if (isProjectError) {
    console.error(projectError);
    return dispatch(
      setFailure({ name: t('errorMessages.error'), message: t('errorMessages.errorNoFrom') })
    );
  }

  const getStudyStates = async (id: number) => {
    try {
      const list = await get(`/projects/${id}/study_states/`);
      setStudyStates(list);
    } catch (error) {
      /* empty */
    }
  };

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

  const getProject = async () => {
    if (currentProject?.id) {
      try {
        setProject(currentProject);
        await getStudyStates(currentProject.id);
      } catch (error) {
        console.error(error);
      }
    }
  };

  const getStudy = async (withNotification = false) => {
    if (projectId && studyId) {
      try {
        const { data } = await getCurrentStudy({ projectId, studyId });
        if (data) setStudy(data as StudyWithFileType);
        if (withNotification) {
          dispatch(
            setSuccess({
              title: t('studyUpdated'),
              text: t('studyUpdatedDetails', { name: study?.name }),
            })
          );
        }
      } catch (error) {
        console.error(error);
      }
    }
  };

  const getScenarioList = async () => {
    if (projectId && studyId) {
      if (filter) {
        const payload: PostSearchApiArg = {
          body: {
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
          const filteredData = await postSearch(payload).unwrap();
          let filteredScenarios = [...filteredData] as SearchScenarioResult[];
          if (sortOption === 'LastModifiedDesc') {
            filteredScenarios = filteredScenarios.sort((a, b) => {
              if (a.last_modification && b.last_modification) {
                return b.last_modification.localeCompare(a.last_modification);
              }
              return 0;
            });
          } else if (sortOption === 'NameAsc') {
            filteredScenarios = filteredScenarios.sort((a, b) => {
              if (a.name && b.name) {
                return a.name.localeCompare(b.name);
              }
              return 0;
            });
          }
          setScenariosList(filteredScenarios);
        } catch (error) {
          console.error(error);
        }
      } else {
        try {
          const { data } = await getScenarios({ projectId, studyId, ordering: sortOption });
          if (data?.results) setScenariosList(data.results);
        } catch (error) {
          console.error(error);
        }
      }
    }
  };

  useEffect(() => {
    if (!studyId || !projectId) {
      navigate('/operational-studies/project');
    } else if (!isProjectLoading) {
      getProject();
      getStudy();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isProjectLoading]);

  useEffect(() => {
    if (studyId) getScenarioList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortOption, filter]);

  return (
    <>
      <NavBarSNCF
        appName={
          <BreadCrumbs
            projectName={project?.name && project.name}
            studyName={study?.name && study.name}
          />
        }
        logo={logo}
      />
      <main className="mastcontainer mastcontainer-no-mastnav">
        <div className="p-3">
          {project && study ? (
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
                />
                <DateBox
                  date={study.expected_end_date ? new Date(study.expected_end_date) : null}
                  className="estimatedend"
                  translation="estimatedend"
                />
                <DateBox
                  date={study.actual_end_date ? new Date(study.actual_end_date) : null}
                  className="realend"
                  translation="realend"
                />
                <DateBox
                  date={study.last_modification ? new Date(study.last_modification) : null}
                  className="modified"
                  translation="modified"
                />
              </div>
              <div className="row">
                <div className="col-xl-9 col-lg-8 col-md-7">
                  <div className="study-details-name">
                    {study.name}
                    <button
                      className="study-details-modify-button"
                      type="button"
                      onClick={() =>
                        openModal(
                          <AddOrEditStudyModal editionMode study={study} getStudy={getStudy} />,
                          'xl'
                        )
                      }
                    >
                      <span className="study-details-modify-button-text">{t('modifyStudy')}</span>
                      <FaPencilAlt />
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
                          project.id &&
                          study.id &&
                          study.state && (
                            <StateStep
                              key={nextId()}
                              projectID={project.id}
                              studyID={study.id}
                              getStudy={getStudy}
                              number={idx + 1}
                              state={state}
                              done={idx <= studyStates.indexOf(study.state)}
                            />
                          )
                      )}
                    </div>
                  )}
                </div>
                <div className="col-xl-3 col-lg-4 col-md-5">
                  <div className="study-details-files">
                    <div className="study-details-files-title">
                      <span className="mr-2">
                        <VscFiles />
                      </span>
                      {t('filesAndLinks')}
                      <span className="ml-auto">{study.files ? study.files.length : 0}</span>
                    </div>
                    <div className="study-details-files-list">
                      {study.files?.map((file) => {
                        const isUrl = Math.random() > 0.5;
                        return (
                          <a
                            href={file.url}
                            key={nextId()}
                            target="_blank"
                            rel="noreferrer"
                            className={isUrl ? 'url' : 'file'}
                          >
                            <span className="study-details-files-list-name">
                              <span className="mr-1">{isUrl ? <VscLink /> : <VscFile />}</span>
                              {file.name}
                            </span>
                            <span className="study-details-files-list-link">
                              {isUrl ? file.url : file.filename}
                            </span>
                          </a>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              <div className="study-details-financials">
                <div className="study-details-financials-infos">
                  <div className="study-details-financials-infos-item">
                    <h3>{t('geremiCode')}</h3>
                    <div>{study.service_code}</div>
                  </div>
                  <div className="study-details-financials-infos-item">
                    <h3>{t('affairCode')}</h3>
                    <div>{study.business_code}</div>
                  </div>
                </div>
                <div className="study-details-financials-amount">
                  <span className="study-details-financials-amount-text">{t('budget')}</span>
                  {study.budget && budgetFormat(study.budget)}
                </div>
              </div>

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
            <div className="">
              {t('scenariosCount', { count: scenariosList ? scenariosList.length : 0 })}
            </div>
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

          <div className="scenarios-list">
            {useMemo(() => displayScenariosList(scenariosList, setFilterChips), [scenariosList])}
          </div>
        </div>
      </main>
    </>
  );
}
