import React, { useContext, useEffect, useMemo, useState } from 'react';
import NavBarSNCF from 'common/BootstrapSNCF/NavBarSNCF';
import logo from 'assets/pictures/views/study.svg';
import { useTranslation } from 'react-i18next';
import Loader from 'common/Loader';
import nextId from 'react-id-generator';
import OptionsSNCF from 'common/BootstrapSNCF/OptionsSNCF';
import ScenarioCard from 'applications/operationalStudies/components/Study/ScenarioCard';
import { VscLink, VscFile, VscFiles } from 'react-icons/vsc';
import { FaPencilAlt, FaPlus } from 'react-icons/fa';
import { budgetFormat } from 'utils/numbers';
import { ModalContext } from 'common/BootstrapSNCF/ModalSNCF/ModalProvider';
import { useSelector, useDispatch } from 'react-redux';
import { getProjectID, getStudyID } from 'reducers/osrdconf/selectors';
import { get } from 'common/requests';
import { setSuccess } from 'reducers/main';
import DateBox from 'applications/operationalStudies/components/Study/DateBox';
import StateStep from 'applications/operationalStudies/components/Study/StateStep';
import FilterTextField from 'applications/operationalStudies/components/FilterTextField';
import { PROJECTS_URI, SCENARIOS_URI, STUDIES_URI } from '../components/operationalStudiesConsts';
import AddOrEditScenarioModal from '../components/Scenario/AddOrEditScenarioModal';
import AddOrEditStudyModal from '../components/Study/AddOrEditStudyModal';
import BreadCrumbs from '../components/BreadCrumbs';

function displayScenariosList(scenariosList, setFilterChips) {
  return scenariosList ? (
    <div className="row no-gutters">
      {scenariosList.map((scenario) => (
        <div className="col-xl-4 col-lg-6" key={nextId()}>
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
  const { openModal } = useContext(ModalContext);
  const [project, setProject] = useState();
  const [study, setStudy] = useState();
  const [scenariosList, setScenariosList] = useState();
  const [filter, setFilter] = useState('');
  const [filterChips, setFilterChips] = useState('');
  const [sortOption, setSortOption] = useState('-last_modification');
  const [studyStates, setStudyStates] = useState([]);
  const dispatch = useDispatch();
  const projectID = useSelector(getProjectID);
  const studyID = useSelector(getStudyID);

  const getStudyStates = async (id) => {
    try {
      const list = await get(`/projects/${id}/study_states/`);
      setStudyStates(list);
    } catch (error) {
      console.log(error);
    }
  };

  const sortOptions = [
    {
      label: t('sortOptions.byName'),
      value: 'name',
    },
    {
      label: t('sortOptions.byRecentDate'),
      value: '-last_modification',
    },
  ];

  const handleSortOptions = (e) => {
    setSortOption(e.target.value);
  };

  const getProject = async () => {
    try {
      const result = await get(`${PROJECTS_URI}${projectID}/`);
      setProject(result);
      await getStudyStates(result.id);
    } catch (error) {
      console.error(error);
    }
  };
  const getStudy = async (withNotification = false) => {
    try {
      const result = await get(`${PROJECTS_URI}${projectID}${STUDIES_URI}${studyID}/`);
      setStudy(result);
      if (withNotification) {
        dispatch(
          setSuccess({
            title: t('studyUpdated'),
            text: t('studyUpdatedDetails', { name: study.name }),
          })
        );
      }
    } catch (error) {
      console.error(error);
    }
  };

  const getScenarioList = async () => {
    try {
      const params = {
        ordering: sortOption,
        name: filter,
        description: filter,
        tags: filter,
      };
      const data = await get(
        `${PROJECTS_URI}${projectID}${STUDIES_URI}${studyID}${SCENARIOS_URI}`,
        { params }
      );
      setScenariosList(data.results);
    } catch (error) {
      console.error(error);
    }
  };

  useEffect(() => {
    getProject();
    getStudy();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    getScenarioList();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortOption, filter]);

  return (
    <>
      <NavBarSNCF
        appName={
          <BreadCrumbs
            projectName={project ? project.name : null}
            studyName={study ? study.name : null}
          />
        }
        logo={logo}
      />
      <main className="mastcontainer mastcontainer-no-mastnav">
        <div className="p-3">
          {project && study ? (
            <div className="study-details">
              <div className="study-details-dates">
                <DateBox date={study.creation_date} className="creation" translation="creation" />
                <DateBox date={study.start_date} className="start" translation="start" />
                <DateBox
                  date={study.expected_end_date}
                  className="estimatedend"
                  translation="estimatedend"
                />
                <DateBox date={study.actual_end_date} className="realend" translation="realend" />
                <DateBox
                  date={study.last_modification}
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
                  {study.type && (
                    <div className="study-details-type">{t(`studyCategories.${study.type}`)}</div>
                  )}
                  <div className="study-details-description">{study.description}</div>
                  {study.state && (
                    <div className="study-details-state">
                      {studyStates.map((state, idx) => (
                        <StateStep
                          key={nextId()}
                          projectID={project.id}
                          studyID={study.id}
                          getStudy={getStudy}
                          number={idx + 1}
                          state={state}
                          done={idx <= studyStates.indexOf(study.state)}
                        />
                      ))}
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
                  {budgetFormat(study.budget)}
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
            <button
              className="btn btn-primary btn-sm"
              type="button"
              onClick={() => openModal(<AddOrEditScenarioModal />, 'xl')}
            >
              <FaPlus />
              <span className="ml-2">{t('createScenario')}</span>
            </button>
          </div>

          <div className="scenarios-list">
            {useMemo(() => displayScenariosList(scenariosList, setFilterChips), [scenariosList])}
          </div>
        </div>
      </main>
    </>
  );
}
