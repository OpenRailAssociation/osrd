import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import NavBarSNCF from 'common/BootstrapSNCF/NavBarSNCF';
import logo from 'assets/pictures/views/study.svg';
import { useTranslation } from 'react-i18next';
import Loader from 'common/Loader';
import nextId from 'react-id-generator';
import OptionsSNCF from 'common/BootstrapSNCF/OptionsSNCF';
import ScenarioCard from 'applications/operationalStudies/components/Study/ScenarioCard';
import { setFailure } from 'reducers/main';
import ScenarioCardEmpty from 'applications/operationalStudies/components/Study/ScenarioCardEmpty';
import { VscLink, VscFile, VscFiles } from 'react-icons/vsc';
import { FaPencilAlt } from 'react-icons/fa';
import { budgetFormat } from 'utils/numbers';
import { useModal } from 'common/BootstrapSNCF/ModalSNCF';
import { useSelector, useDispatch } from 'react-redux';
import { getProjectID, getStudyID } from 'reducers/osrdconf/selectors';
import DateBox from 'applications/operationalStudies/components/Study/DateBox';
import StateStep from 'applications/operationalStudies/components/Study/StateStep';
import {
  PostSearchApiArg,
  ScenarioResult,
  SearchScenarioResult,
  StudyResult,
  osrdEditoastApi,
} from 'common/api/osrdEditoastApi';
import BreadCrumbs from '../components/BreadCrumbs';
import AddOrEditStudyModal from '../components/Study/AddOrEditStudyModal';
import FilterTextField from '../components/FilterTextField';
import { studyStates } from '../consts';

type SortOptions =
  | 'NameAsc'
  | 'NameDesc'
  | 'CreationDateAsc'
  | 'CreationDateDesc'
  | 'LastModifiedAsc'
  | 'LastModifiedDesc';

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
      <div className="col-hdp-3 col-hd-4 col-lg-6">
        <ScenarioCardEmpty />
      </div>
      {scenariosList.map((scenario) => (
        <div
          className="col-hdp-3 col-hd-4 col-lg-6"
          key={`study-displayScenariosList-${scenario.id}`}
        >
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
  const [scenariosList, setScenariosList] = useState<ScenarioResult[]>([]);
  const [filter, setFilter] = useState('');
  const [filterChips, setFilterChips] = useState('');
  const [sortOption, setSortOption] = useState<SortOptions>('LastModifiedDesc');
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const projectId = useSelector(getProjectID);
  const studyId = useSelector(getStudyID);

  const { data: project, isError: isProjectError } = osrdEditoastApi.useGetProjectsByProjectIdQuery(
    { projectId: projectId as number },
    {
      skip: !projectId,
    }
  );

  const { data: study, isError: isCurrentStudyError } =
    osrdEditoastApi.useGetProjectsByProjectIdStudiesAndStudyIdQuery(
      {
        projectId: projectId as number,
        studyId: studyId as number,
      },
      {
        skip: !projectId || !studyId,
      }
    );

  const [postSearch] = osrdEditoastApi.usePostSearchMutation();
  const [getScenarios] =
    osrdEditoastApi.useLazyGetProjectsByProjectIdStudiesAndStudyIdScenariosQuery();

  useEffect(() => {
    if (!projectId || !studyId) navigate('/operational-studies/project');
  }, [projectId, studyId]);

  useEffect(() => {
    if (isProjectError || isCurrentStudyError) {
      dispatch(
        setFailure({
          name: t('errorHappened'),
          message: t('errorHappened'),
        })
      );
    }
  }, [isProjectError, isCurrentStudyError]);

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

  // TODO: use Files when it is implemented in the backend
  const getFileSection = () => (
    <div className="study-details-files">
      <div className="study-details-files-title">
        <span className="mr-2">
          <VscFiles />
        </span>
        {t('filesAndLinks')}
        <span className="ml-auto">
          {(study as StudyWithFileType).files ? (study as StudyWithFileType).files.length : 0}
        </span>
      </div>
      <div className="study-details-files-list">
        {(study as StudyWithFileType).files?.map((file) => {
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
  );

  const getScenarioList = async () => {
    if (projectId && studyId) {
      if (filter) {
        const payload: PostSearchApiArg = {
          body: {
            object: 'scenario',
            page_size: 1000,
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
                    <div className="study-name">{study.name}</div>
                    <button
                      className="study-details-modify-button"
                      type="button"
                      onClick={() =>
                        openModal(<AddOrEditStudyModal editionMode study={study} />, 'xl')
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
                              number={idx + 1}
                              studyName={study.name}
                              state={state}
                              done={idx <= studyStates.indexOf(study.state)}
                              tags={study.tags}
                            />
                          )
                      )}
                    </div>
                  )}
                </div>
                <div className="col-xl-3 col-lg-4 col-md-5">{getFileSection()}</div>
              </div>

              <div className="study-details-financials">
                <div className="study-details-financials-infos">
                  <div className="study-details-financials-infos-item">
                    <h3>{t('geremiCode')}</h3>
                    <div className="code">{study.service_code}</div>
                  </div>
                  <div className="study-details-financials-infos-item">
                    <h3>{t('affairCode')}</h3>
                    <div className="code">{study.business_code}</div>
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
